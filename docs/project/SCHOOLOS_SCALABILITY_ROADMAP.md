# SchoolOS Scalability Roadmap

**Repository:** `erwinshrestha17/SchoolOS`  
**Stage:** Phase 2 implemented foundations + Phase 3 operations admin foundations
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard  
**Purpose:** Define how SchoolOS scales phase by phase while development continues across the SaaS starter/platform core and school-domain modules.

---

## 1. Executive Summary

SchoolOS should scale by strengthening the current modular monolith first.

The correct scalability path is:

```text
1. Keep the modular monolith.
2. Make module boundaries strict.
3. Align backend/API/frontend structure with M0 Platform Core + M1-M10 school modules.
4. Make tenant isolation impossible to bypass.
5. Make PostgreSQL queries/indexes production-safe.
6. Move slow work into Redis/BullMQ workers.
7. Add observability, readiness, backup, and smoke gates.
8. Scale API and workers horizontally.
9. Split only proven high-pressure modules later.
```

Do **not** jump to microservices now. The repo already has a good foundation: NestJS modules, Prisma, Redis/BullMQ, throttling, CLS tenant context, health/readiness endpoints, production verification scripts, Docker PostgreSQL/Redis, and Phase 1 smoke/preflight work.

The main risk now is not lack of microservices. The main risk is Phase 2/3 module breadth growing faster than tenant isolation, indexing, queue boundaries, report performance, audit depth, operational monitoring, and frontend route separation.

---

## 2. Source Documents Used

This roadmap must stay aligned with these files:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_PROJECT_MEMORY.md
docs/project/SCHOOLOS_PHASE_STRUCTURE.md
docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

Important findings from those docs:

```text
- SchoolOS has implemented Phase 2 foundations and Phase 3 operations admin foundations.
- Phase 1A/1B are pilot-ready.
- M0 Platform Core contains reusable SaaS starter/platform capabilities.
- M1-M10 define the real school product modules.
- Current frontend stays in apps/web Next.js for now.
- Future apps/admin Angular dashboard is deferred.
- Microservices are deferred until scale/team/deployment/compliance justify them.
- Parent/mobile portal, driver app, live transport map/WebSocket UI, full canteen inventory/vendor workflows, and AI/ML are deferred.
```

---

## 3. Product Module Map

## 3.1 M0 SaaS Starter / Platform Core Modules

These are the reusable SaaS/starter capabilities already documented in the platform core roadmap. They should be added gradually into SchoolOS instead of blindly copying a generic SaaS template.

| M0 Capability | Backend Module Area | API Namespace | Current/Future Frontend Area | Scaling Notes |
|---|---|---|---|---|
| Platform Control Plane | `platform/` | `/api/v1/platform/*` | `/platform/*` | Cross-tenant access; platform-only permissions; audit every tenant-impacting action. |
| Tenant Settings | `settings/` | `/api/v1/settings/*` or `/api/v1/tenant-settings/*` | `/dashboard/settings/*` | Tenant-scoped config; cache safe read settings; audit writes. |
| Generic File Registry | `file-registry/`, `storage/` | `/api/v1/files/*` | shared upload/download UI | Central metadata for files; signed URLs; object storage-ready. |
| Global API Response Envelope | common/interceptors/filters | all JSON APIs | shared API client | Include requestId later; exempt PDF/CSV/file streams. |
| Generic Reports Foundation | `reports/` | `/api/v1/reports/*` | module report tabs | Background heavy exports; audit report exports. |
| Safe Activity Logs | `audit/` + future activity-log projection | `/api/v1/activity-logs/*` later | admin/user history panels | Safe operational logs separate from compliance audit and parent activity feed. |
| Usage Limits & Plan Rules | `platform/`, `tenants/` | `/api/v1/platform/plans/*` | `/platform/*`, locked feature UI | Server-side entitlement enforcement; start read-only before hard blocking. |
| API Key Management | future `api-keys/` | `/api/v1/api-keys/*` | `/platform/*` or tenant settings | Hash keys only; scopes; rate limits; tenant isolation. |
| Webhook System | future `webhooks/` | `/api/v1/webhooks/*` | `/platform/*` or tenant settings | BullMQ delivery; signed payloads; retry/backoff. |
| SaaS Subscription & Billing | future `platform-billing/` | `/api/v1/platform/billing/*` | `/platform/billing/*` | Separate from school fees; platform audit; safe suspension rules. |

## 3.2 M1-M10 School Product Modules

| Module | Name | Phase | Current Backend Area | API Namespace Direction | Frontend Area Direction |
|---|---|---:|---|---|---|
| M1 | Admissions & Student Profiles | Phase 1 | `admissions/`, `students/`, `student-records/` | `/api/v1/admissions`, `/api/v1/students`, `/api/v1/student-records` | `/dashboard/admissions`, `/dashboard/students/*` |
| M2 | Smart Attendance | Phase 1 | `attendance/` | `/api/v1/attendance/*` | `/dashboard/attendance` |
| M3 | Fees & Receipts | Phase 1 | `finance/` | `/api/v1/finance/*` | `/dashboard/finance` |
| M4 | Exams, CAS & Report Cards | Phase 2 foundation implemented | `academics/` | `/api/v1/academics/*` | `/dashboard/academics` |
| M5 | Activity Feed & Milestones | Phase 1 | `activity-feed/` | `/api/v1/activity-feed/*` | `/dashboard/activity` |
| M6 | Homework & Timetable | Phase 2 foundation implemented | `timetable/`, `homework/` | `/api/v1/timetable/*`, `/api/v1/homework/*` | `/dashboard/timetable`, `/dashboard/homework` |
| M7 | HR & Payroll | Phase 2 foundation implemented | `staff/`, `hr/`, `payroll/` | `/api/v1/staff/*`, `/api/v1/hr/*`, `/api/v1/payroll/*` | `/dashboard/hr`, `/dashboard/payroll`, `/dashboard/staff/*` |
| M8A | Library Management | Phase 3 admin foundation implemented | `library/` | `/api/v1/library/*` | `/dashboard/library/*` |
| M8B | Transport Management | Phase 3 admin foundation implemented | `transport/` | `/api/v1/transport/*` | `/dashboard/transport/*`; parent tracking later |
| M8C | Canteen Management | Phase 3 admin foundation implemented | `canteen/` | `/api/v1/canteen/*` | `/dashboard/canteen/*`; inventory/vendor later |
| M9 | Accounting & Finance | Phase 2 foundation implemented; hardening priority | `accounting/` + finance posting boundary | `/api/v1/accounting/*` | `/dashboard/accounting` |
| M10 | Notices & Communication | Phase 1 + parent-teacher chat foundation | `communications/`, `notifications/`, `messaging/` | `/api/v1/communications/*`, `/api/v1/notifications/*`, `/api/v1/messaging/*` | `/dashboard/notices`, `/dashboard/messages`, notification center |

## 3.3 Mapping from Generic Names to Current Repo Modules

Use the current repo names unless a deliberate refactor is planned:

```text
fees/receipts          -> finance/
exams/CAS/report cards -> academics/
homework-timetable     -> timetable/ now; split homework/ later only if useful
hr-payroll             -> staff/ + payroll/
notices                -> communications/ + notifications/
parent-teacher chat    -> messaging/ + communications/
file uploads           -> file-registry/ + storage/
SaaS starter modules   -> platform/, tenants/, settings/, reports/, audit/, file-registry/
```

---

## 4. Scalable Repository Structure

## 4.1 Current Monorepo Direction

```text
SchoolOS/
  apps/
    api/         NestJS modular monolith backend
    web/         Current Next.js dashboard + platform console + public/root pages
    admin/       Future Angular internal dashboard, not now
  packages/
    core/        Shared contracts, validation, permissions, types
  docs/
    project/     project memory, roadmap, scalability docs
    production/  deployment/runbook/backup docs
  scripts/       verification, smoke, deploy checks
```

## 4.2 Scalable Backend Structure

Expected backend module shape:

```text
apps/api/src
  main.ts
  app.module.ts

  auth/
  tenants/
  platform/
  settings/
  users/
  roles/

  admissions/
  students/
  student-records/
  attendance/
  finance/
  academics/
  timetable/
  staff/
  payroll/
  library/
  transport/
  canteen/
  accounting/
  activity-feed/
  communications/
  messaging/
  notifications/

  reports/
  file-registry/
  storage/
  audit/
  redis/
  prisma/
  config/

  shared/               shared utilities only, not business dumping ground
```

Each production module should own or clearly define:

```text
<module>.module.ts
<module>.controller.ts
<module>.service.ts
repositories/ or data-access boundary where useful
dto/ request/response validation contracts
policies/ permissions/RBAC helpers where useful
events/ domain events and integration event handlers where useful
processors/ BullMQ processors if the module owns background jobs
schemas/ Prisma ownership notes or module model documentation
tests/ unit, integration, e2e/contract tests where relevant
```

Suggested internal module shape:

```text
apps/api/src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  dto/
  events/
  processors/
  repositories/
  policies/
  tests/
```

This does not require moving every existing file immediately. Use this shape for new work and refactor old modules gradually only when touching them.

## 4.3 Scalable API Namespace Structure

All external APIs remain versioned under `/api/v1`.

```text
/api/v1/auth/*
/api/v1/platform/*                 M0 platform control plane
/api/v1/tenants/*                  tenant onboarding/internal tenant mgmt
/api/v1/settings/*                 tenant configuration
/api/v1/files/*                    file registry/signed download
/api/v1/reports/*                  generic reports/export foundation

/api/v1/admissions/*               M1
/api/v1/students/*                 M1
/api/v1/student-records/*          M1
/api/v1/attendance/*               M2
/api/v1/finance/*                  M3
/api/v1/academics/*                M4
/api/v1/activity-feed/*            M5
/api/v1/timetable/*                M6
/api/v1/homework/*                 M6 homework foundation
/api/v1/staff/*                    M7
/api/v1/payroll/*                  M7
/api/v1/library/*                  M8A
/api/v1/transport/*                M8B
/api/v1/canteen/*                  M8C admin foundation
/api/v1/accounting/*               M9
/api/v1/communications/*           M10
/api/v1/notifications/*            M10
/api/v1/messaging/*                M10 chat/messaging
```

API rules:

```text
- Controllers stay thin.
- DTOs validate every external input.
- Tenant-owned APIs derive tenantId from auth/CLS, not frontend payloads.
- List endpoints use pagination and filters from the start.
- File/PDF/CSV endpoints may bypass the JSON envelope when raw streams are required.
- Business-critical writes use transactions and audit logs.
- Slow/provider/report/PDF work goes to BullMQ.
```

## 4.4 Scalable Frontend Structure

Current frontend remains Next.js in `apps/web`.

Route plane separation:

```text
apps/web/app
  /(public)/ or root pages       public website/login/admissions later
  /platform/*                    SchoolOS owner/operator console
  /dashboard/settings/*          tenant/school configuration
  /dashboard/*                   school operations
```

Recommended feature structure:

```text
apps/web
  app/
    platform/
    dashboard/
      admissions/
      students/
      attendance/
      finance/
      academics/
      activity/
      timetable/
      homework/
      hr/
      payroll/
      library/
      transport/
      canteen/
      accounting/
      notices/
      messages/
      settings/
  components/
    shells/
    forms/
    modules/
  lib/
    api.ts or api/
    auth.ts
    query.ts
    permissions.ts
  test/
```

Frontend scalability rules:

```text
- Do not load every module on the dashboard landing page.
- Use route-level/lazy feature separation.
- Use server-side filtering, pagination, and search; do not fetch all rows and filter in browser.
- Keep platform UI visually and permission-separated from school dashboard UI.
- Use shared API client conventions for pagination, errors, and requestId later.
- Keep role-based menu rendering, but never treat hidden frontend menus as security.
- Preserve cookie-first auth; do not store raw tokens in browser storage.
```

## 4.5 Future Angular Admin Structure

Angular admin migration is deferred. When it happens:

```text
apps/admin
  src/app/core/          auth, API client, guards, interceptors
  src/app/layouts/       platform shell, dashboard shell
  src/app/features/      admissions, attendance, finance, academics, etc.
  src/app/shared/        reusable UI components only
```

Do not start Angular migration until current Next.js dashboard and pilot workflow are stable.

## 4.6 Shared Package Structure

`packages/core` should contain shared contracts, not backend business logic.

Allowed:

```text
permission keys
DTO-style TypeScript types
Zod schemas / validation contracts where shared safely
report contracts
frontend/backend shared constants
```

Avoid:

```text
Prisma access
business service logic
module-specific domain workflows
secrets/provider code
frontend-only UI code
```

---

## 5. Core Scalability Principles

## 5.1 Modular Monolith First

SchoolOS must use one backend application for now, but it must be split clearly by business modules.

Module communication rule:

```text
Modules communicate through public services, domain events, queues, or explicit integration boundaries.
Modules must not directly bypass another module's business rules by writing its internal tables.
```

Good examples:

```text
finance -> AccountingPostingService -> journal entries
payroll -> PayrollPostingService / AccountingPostingService -> journal entries
notices -> Notification queue -> delivery worker
transport -> Redis latest location cache -> parent tracking API
reports -> module report service -> background export worker
```

Bad examples:

```text
Any module writes another module's internal tables directly.
Frontend calculates business-critical totals.
Long-running PDF/report generation happens inside request-response.
TenantId comes from frontend input instead of authenticated context.
shared/ becomes a dumping ground for business logic.
```

This keeps SchoolOS simple now and easier to split later if one module proves it needs independent scaling.

## 5.2 Tenant Isolation Is the First Scaling Rule

Every tenant-owned table must include `tenantId` unless it is explicitly global/platform metadata.

Every tenant-owned read/write must scope by authenticated tenant context.

Required pattern:

```ts
where: {
  tenantId: tenantContext.tenantId,
  id,
}
```

Forbidden pattern:

```ts
where: {
  id,
}
```

Exception: platform-control APIs may access cross-tenant data only with explicit platform permissions and audited support/tenant override.

## 5.3 Every New Phase Must Include Scalability Work

Every feature phase must include:

```text
1. Tenant scope check
2. Permission check
3. Pagination/filtering for lists
4. Index review
5. Audit/logging review
6. Queue decision: sync or async?
7. Cache decision: cache or not?
8. Report/export decision: immediate or background?
9. Frontend route/API-client impact
10. Test coverage
11. Production verification command
```

---

## 6. Target Scalable Runtime Architecture

Near-term target:

```text
Browser / Mobile Client
        |
        v
Reverse Proxy / Load Balancer
        |
        v
NestJS API instances 1..N
        |
        +--> PostgreSQL primary database
        +--> Redis cache / BullMQ queue
        +--> Object storage
        +--> Worker processes
```

Important separation:

```text
schoolos-api       Handles HTTP requests only
schoolos-worker    Handles queues: notifications, reports, PDFs, imports, exports
schoolos-scheduler Handles scheduled jobs: reminders, summaries, cleanup
```

At first these can run from the same codebase. They should eventually be separate process entrypoints or separate container commands.

---

## 7. Phase-Wise Scalability Implementation Plan

## Phase S0 — Current Baseline Lock

**Goal:** Protect what is already working before Phase 2 grows further.

Implementation tasks:

```text
✅ Keep modular monolith.
✅ Keep module boundaries strict.
✅ Keep module communication through public services/events/queues, not direct database hacks.
✅ Keep each module responsible for controller/service/repository-or-data-access/dto/permissions/events/tests.
✅ Keep Next.js dashboard for now.
✅ Keep backend/API/frontend route structure aligned with M0 + M1-M10 module map.
✅ Keep tenantId as the tenant boundary.
✅ Keep PostgreSQL + Prisma.
✅ Keep Redis + BullMQ.
✅ Keep current /health and /ready endpoints.
✅ Keep verify:production and smoke:phase1 gates.
```

Exit criteria:

```text
- PROJECT_CONTEXT.md points to this roadmap.
- Codex/AI-agent prompts mention this roadmap for every major feature.
- No module starts Phase 2 work without tenant/pagination/index/audit/queue review.
- No module bypasses another module's public service/event/queue boundary for business-critical writes.
```

## Phase S1 — Database, API, and Tenant Query Hardening

**Goal:** Make PostgreSQL and APIs safe for multi-school growth.

High-growth tables:

```text
students, attendance_sessions, attendance_records,
invoices, invoice_lines, payments, receipts, cashier_closes,
journal_entries, journal_lines, audit_logs,
notification_deliveries, activity_posts, activity_attachments,
mark_entries, report_cards, payroll_runs, payroll_lines,
messages, transport_logs, file_assets
```

Implementation tasks:

```text
1. Review every list endpoint for pagination.
2. Add server-side filtering for date/class/section/status/search.
3. Add indexes for tenant-scoped query patterns.
4. Add composite uniqueness where duplicates are dangerous.
5. Add tenantId to missing tenant-owned entities if any are found.
6. Add tests that verify cross-tenant access is rejected.
7. Add frontend API helpers that expect paginated responses.
8. Add slow-query logging configuration for staging.
```

Recommended index patterns:

```prisma
@@index([tenantId, createdAt])
@@index([tenantId, status, createdAt])
@@index([tenantId, academicYearId])
@@index([tenantId, classId, sectionId])
@@index([tenantId, studentId])
@@index([tenantId, attendanceDate])
@@index([tenantId, dueDate, status])
@@index([tenantId, sourceType, sourceId])
```

Exit criteria:

```text
- All new Phase 2 list APIs are paginated.
- All high-growth queries have matching indexes.
- Cross-tenant tests exist for critical modules.
- No frontend list depends on loading all rows.
```

## Phase S2 — API/Worker Separation and Queue Discipline

**Goal:** Keep API requests fast by moving slow or retryable work out of request-response.

Move to BullMQ workers:

```text
notification delivery
SMS/email/push provider calls
report card PDF generation
receipt/certificate batch generation
monthly attendance summary generation
fee invoice batch generation
defaulter reminder jobs
payroll posting jobs
large CSV/PDF exports
activity media processing/compression
future transport ETA jobs
future canteen low-balance alerts
```

Recommended queues:

```text
notifications.delivery
reports.generate
pdf.generate
finance.billing
finance.defaulters
payroll.posting
academics.report-cards
activity.media
transport.location
platform.maintenance
```

Exit criteria:

```text
- API endpoints return quickly for heavy workflows.
- Queue failures are visible in logs/admin screens.
- Retried jobs are idempotent.
- Notification/report/PDF work is not blocking core transactions.
```

## Phase S3 — Caching and Read Model Strategy

Good cache targets:

```text
current tenant settings
current academic year
user permission snapshot
dashboard finance summary
attendance daily summary
fee collection daily total
notification unread count
latest bus/trip location
platform tenant health summary
```

Avoid caching:

```text
financial posting truth
ledger truth
permission changes without invalidation
medical/compliance-sensitive raw data
large unbounded query results
```

Redis key conventions:

```text
tenant:{tenantId}:settings
tenant:{tenantId}:academic-year:current
user:{userId}:permissions
dashboard:{tenantId}:finance:{date}
attendance:{tenantId}:summary:{date}:{classId}:{sectionId}
notification:{tenantId}:{userId}:unread-count
transport:{tenantId}:trip:{tripId}:latest-location
```

## Phase S4 — Observability, Operational Safety, and Release Gates

Required signals:

```text
request ID / correlation ID
structured API logs
error logs
slow DB query tracking
queue job success/failure metrics
provider delivery failures
readiness status
storage write failures
PDF generation failures
audit log review for sensitive actions
```

Runtime endpoints:

```text
GET /api/v1/health
GET /api/v1/ready
GET /api/v1/metrics     later
```

Minimum deployment gate:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```

## Phase S5 — File Storage and Media Scaling

Use object storage for:

```text
student documents
student photos
school logos
activity media
homework attachments
receipts
certificates
report cards
salary slips
exports
```

Implementation tasks:

```text
1. Keep File Registry as central metadata boundary.
2. Store object keys, not permanent public URLs.
3. Generate signed URLs for preview/download.
4. Add file size/type validation.
5. Add tenantId, module, entityId to file metadata.
6. Add media compression for activity feed images.
7. Add lifecycle/retention rules.
8. Add backup/restore test for storage.
```

## Phase S6 — Horizontal Scaling

Deployment target:

```text
Load balancer
  -> schoolos-api-1
  -> schoolos-api-2
  -> schoolos-api-3

schoolos-worker-notifications
schoolos-worker-reports
schoolos-worker-finance
schoolos-scheduler

PostgreSQL
Redis
Object Storage
```

Implementation tasks:

```text
1. Ensure API is stateless.
2. Keep browser auth cookie-first and server-verified.
3. Use Redis/shared backing for queues and cache.
4. Run multiple API containers behind a load balancer.
5. Run workers separately from API instances.
6. Ensure scheduled jobs are not duplicated across replicas.
7. Use database connection pooling.
8. Add graceful shutdown for API and workers.
```

## Phase S7 — High-Volume Module Specialization

High-volume candidates:

```text
Transport GPS tracking
Notification delivery
Report/PDF generation
Activity media processing
Analytics/read models
AI/ML inference later
```

Possible future extraction candidates:

```text
transport-location-service
notification-service
report-generation-service
analytics-service
ai-inference-service
```

Do **not** extract M1 students, M2 attendance, M3 fees, M4 exams, or M9 accounting early unless there is a strong reason. These modules are highly relational and transaction-sensitive.

## Phase S8 — Data Partitioning, Archival, and Reporting Scale

Partition/archive candidates:

```text
attendance_records by academic year/month
notification_deliveries by month
transport_logs by day/month
audit_logs by month
journal_lines by fiscal year if volume becomes large
messages by academic year/conversation if volume grows
```

Reporting strategy:

```text
Operational reports: query optimized transactional DB with indexes.
Heavy reports: generate in background and store result file.
Analytics dashboards: use read models/materialized views later.
AI/ML datasets: export anonymized/consented data through controlled pipelines later.
```

---

## 8. Module-by-Module Scalability Rules

## M0 Platform Core

Must implement:

```text
- Platform permissions separate from tenant roles.
- Audit all support/tenant override actions.
- Track per-tenant usage counters gradually.
- Add platform health dashboard once workers/providers are active.
- Keep SaaS billing separate from school fees.
- Keep platform routes `/platform/*` separate from school dashboard routes.
```

## M1 Admissions & Student Profiles

```text
- Paginated student directory.
- Indexed search by tenant/class/section/status.
- Object storage-backed photos/documents.
- Background batch certificate generation.
- Cross-tenant access tests.
```

## M2 Smart Attendance

```text
- Unique tenant/date/class/section session rule.
- Bulk insert/update transactions.
- Monthly reports generated efficiently.
- Index by tenant/date/class/section/student.
- Future offline sync queue or conflict review model.
```

## M3 Fees & Receipts

```text
- Decimal-only money handling.
- Transactional payment + receipt + ledger posting.
- Background billing runs for large schools.
- Indexed invoice/payment/receipt queries.
- Idempotency for payment/posting operations.
- Strict audit for reversals/refunds/cashier close.
```

## M4 Exams, CAS & Report Cards

```text
- Tenant/class/section/term/subject indexes.
- Batch marks entry with validation.
- Locking workflow and audit.
- Background report card PDF generation.
- Result publish workflow with notifications queued.
```

## M5 Activity Feed & Milestones

```text
- Object storage and signed previews.
- Media compression queue.
- Tenant/audience scoped reads.
- Pagination/infinite scroll.
- Consent-aware delivery.
```

## M6 Homework & Timetable

```text
- Teacher/room/time conflict indexes.
- Timetable versioning.
- Effective-from dates.
- Publish/lock/archive workflow.
- Substitution checks against leave and availability.
- Attachment storage via File Registry.
```

## M7 HR & Payroll

```text
- Payroll run status machine.
- Payroll posting through accounting boundary only.
- Decimal-safe calculations.
- Background payslip generation.
- Audit approval/posting/void actions.
```

## M8A Library Management

```text
- Indexed book/copy search.
- Unique copy barcode per tenant.
- Scheduled overdue calculation.
- Fine posting through finance/accounting boundary if used.
```

## M8B Transport Management

```text
- Store latest GPS in Redis.
- Persist trip history in PostgreSQL with retention/partition strategy.
- Use WebSocket/SSE with Redis Pub/Sub when multiple API instances exist.
- Do not let GPS writes overload the main transactional API.
- Future device/geofence/overspeed features should be isolated behind transport boundaries.
```

## M8C Canteen Management

```text
- Wallet ledger with immutable movements.
- QR serving idempotency.
- Parent spending controls cached carefully.
- Low-balance notifications queued.
- Allergy warnings from M1 health/allergy profile.
- AccountingPostingService integration for financial movements.
```

## M9 Accounting & Finance

```text
- Never edit confirmed journal entries.
- Enforce debit = credit.
- Use Decimal/numeric only.
- Enforce period state before posting.
- Use backend reports only.
- Generate heavy reports asynchronously if needed.
- Consider fiscal-year partitioning later if volume grows.
```

## M10 Notices & Communication

```text
- Queue all external delivery work.
- Store delivery status per recipient/channel.
- Retry with backoff.
- Respect quiet hours and school-configured chat hours.
- Use Redis unread counters only as cache, not source of truth.
- Parent-class teacher chat must be one thread per student per academic year.
```

---

## 9. Scalability Gate for Every New Feature

Before implementing any feature, answer:

```text
1. Which module owns this feature: M0 or M1-M10?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
```

Feature is not production-ready until these are answered.

---

## 10. Codex / AI Agent Implementation Prompt Template

Use this for future implementation phases:

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_PHASE_STRUCTURE.md
- docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md

Task:
[exact feature/change]

Scalability requirements:
- Keep NestJS modular monolith.
- Align the change with M0 Platform Core or the correct M1-M10 module.
- Keep backend folder, API namespace, and frontend route ownership clear.
- Keep module boundaries strict.
- Each module must own/define controller, service, data-access/repository boundary, DTOs, permissions, events, and tests where relevant.
- Modules must communicate through public services, events, queues, or explicit integration boundaries.
- Do not introduce microservices unless explicitly requested.
- Keep tenantId as the tenant/school boundary.
- All tenant-owned reads/writes must be tenant-scoped.
- All list endpoints must support pagination and filtering.
- Add or review Prisma indexes for new high-volume query patterns.
- Move slow/retryable/provider work to BullMQ workers.
- Use Redis only for cache/queue/latest-value use cases, not source-of-truth finance data.
- Add audit logs for sensitive writes.
- Keep accounting writes behind AccountingPostingService or a clear accounting boundary.
- Add/update tests for permissions, tenant isolation, and main workflow.
- Run relevant verification commands.

Return:
- Summary
- Files changed
- Backend/API/frontend ownership decisions
- Scalability decisions made
- Tests run
- Verification results
- Remaining risks
```

---

## 11. Recommended Immediate Next Implementation Order

Do next:

```text
1. Harden one existing vertical at a time instead of opening new scope.
2. Prioritize M9 accounting correctness, posting/reversal tests, and module posting boundaries.
3. Apply S1/S2 to Academics, Homework/Timetable, HR/Payroll, Library, Transport, and Canteen: indexes, pagination, tenant tests, and report/PDF/queue decisions.
4. Add or formalize API/worker entrypoint before heavy report/PDF usage expands.
5. Add request/correlation ID logging.
6. Add queue failure visibility for notifications/reports/payroll/PDF work.
7. Harden File Registry/object storage before student photo/activity/homework uploads expand.
8. Keep parent/mobile portal, driver app, live transport map/WebSocket UI, full canteen inventory/vendor workflows, and AI/ML deferred.
```

Avoid now:

```text
❌ Angular migration
❌ AI/ML features
❌ Parent/mobile portal before admin foundations are stable
❌ Driver app or live transport map/WebSocket UI before Redis/WebSocket scaling plan
❌ Full canteen inventory/vendor workflows before menu, wallet, POS, reports, and accounting boundaries are hardened
❌ Microservices
❌ Broad expansion across every module at once
```

---

## 12. Final Rule

SchoolOS becomes scalable by making every development phase production-aware.

```text
Build feature -> identify M0/M1-M10 owner -> align backend/API/frontend route -> enforce tenant isolation -> keep module boundary -> index queries -> paginate lists -> queue slow work -> audit sensitive actions -> verify with tests -> only then move to next feature.
```

Scalability is not a separate final task. It is a rule applied during every module implementation from this point onward.
