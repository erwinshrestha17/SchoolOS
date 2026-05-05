# SchoolOS Scalability Roadmap

**Repository:** `erwinshrestha17/SchoolOS`  
**Stage:** Phase 2 Transition Readiness  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard  
**Purpose:** This document explains how SchoolOS should become scalable phase by phase, and how scalability work must be implemented alongside normal product development instead of being postponed until the end.

---

## 1. Executive Summary

SchoolOS should scale by strengthening the current modular monolith first.

The correct scalability path is:

```text
1. Keep the modular monolith.
2. Make module boundaries strict.
3. Make tenant isolation impossible to bypass.
4. Make PostgreSQL queries/indexes production-safe.
5. Move slow work into Redis/BullMQ workers.
6. Add observability, readiness, backup, and smoke gates.
7. Scale API and workers horizontally.
8. Split only proven high-pressure modules later.
```

Do **not** jump to microservices now. The repo already has a good foundation: NestJS modules, Prisma, Redis/BullMQ, throttling, CLS tenant context, health/readiness endpoints, production verification scripts, Docker PostgreSQL/Redis, and Phase 1 smoke/preflight work.

The main risk now is not lack of microservices. The main risk is Phase 2 breadth growing faster than tenant isolation, indexing, queue boundaries, report performance, audit depth, and operational monitoring.

---

## 2. Current Repo Scalability Assessment

## 2.1 Strengths Already Present

Current strengths:

```text
✅ pnpm monorepo
✅ NestJS modular-monolith backend
✅ PostgreSQL + Prisma data layer
✅ Redis module
✅ BullMQ dependency and root configuration
✅ EventEmitter module
✅ Schedule module
✅ Global throttling guard
✅ CLS tenant context foundation
✅ Health endpoint
✅ Readiness endpoint checking database and Redis
✅ Docker Compose for local Postgres and Redis
✅ Production verification scripts
✅ Phase 1 smoke test command
✅ Platform Control Plane separation
✅ Tenant Configuration Plane separation
✅ School Operations Plane separation
✅ M9 Accounting boundary rules documented
```

The repo is already in a better scaling position than a basic CRUD school app because the critical platform primitives are present.

## 2.2 Current Scalability Gaps / Risks

Remaining risks:

```text
⚠️ Some older context docs still need to consistently reflect Phase 2 Transition Readiness.
⚠️ Phase 2 modules are expanding quickly: academics, timetable, payroll, accounting, library, transport.
⚠️ Canteen is planned but not yet fully active.
⚠️ Report-heavy workflows may become slow without background generation and caching.
⚠️ Attendance, notification, audit, transport, delivery, and ledger tables will grow quickly.
⚠️ Prisma query patterns must consistently enforce tenantId and pagination.
⚠️ Object storage/provider configuration still needs production hardening.
⚠️ Readiness is present but metrics/structured observability need deeper implementation.
⚠️ API and worker process separation should become explicit before broad pilot rollout.
```

## 2.3 Current Scalability Verdict

```text
Single-school local development: Strong
Controlled pilot: Good, with staging checks
Multi-school early production: Needs Phase S1/S2 scalability hardening
Large multi-school SaaS: Not ready yet
Microservices: Not needed yet
```

SchoolOS should scale first to several pilot schools using the same modular monolith, then optimize based on real bottlenecks.

---

## 3. Core Scalability Principles

## 3.1 Modular Monolith First

Every feature must stay inside a clear business module.

Good:

```text
finance -> AccountingPostingService -> journal entries
payroll -> PayrollPostingService / AccountingPostingService -> journal entries
notices -> Notification queue -> delivery worker
transport -> Redis latest location cache -> parent tracking API
```

Bad:

```text
Any module writes another module's internal tables directly.
Frontend calculates business-critical totals.
Long-running PDF/report generation happens inside request-response.
TenantId comes from frontend input instead of authenticated context.
```

## 3.2 Tenant Isolation Is the First Scaling Rule

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

## 3.3 Every New Phase Must Include Scalability Work

Do not build features first and add scalability later.

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
9. Test coverage
10. Production verification command
```

---

## 4. Target Scalable Architecture

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

## 5. Phase-Wise Scalability Implementation Plan

## Phase S0 — Current Baseline Lock

**Goal:** Protect what is already working before Phase 2 grows further.

Current baseline:

```text
Phase 1A: completed
Phase 1B: pilot-ready
Phase 2A Academics foundation: started/merged
Payroll/accounting posting foundation: active
Cashier close: recently improved
Production preflight/smoke checks: present
```

Implementation tasks:

```text
✅ Keep modular monolith.
✅ Keep Next.js dashboard for now.
✅ Keep tenantId as the tenant boundary.
✅ Keep PostgreSQL + Prisma.
✅ Keep Redis + BullMQ.
✅ Keep current /health and /ready endpoints.
✅ Keep verify:production and smoke:phase1 gates.
```

Do now:

```text
1. Update all project context docs to reflect Phase 2 Transition Readiness.
2. Add this scalability roadmap as a required planning reference.
3. Stop broad feature expansion without scalability gate checks.
4. Keep Phase 2 work vertical, not horizontal.
```

Exit criteria:

```text
- PROJECT_CONTEXT.md points to this roadmap.
- Codex/AI-agent prompts mention this roadmap for every major feature.
- No module starts Phase 2 work without tenant/pagination/index/audit/queue review.
```

---

## Phase S1 — Database and Tenant Query Hardening

**Goal:** Make PostgreSQL safe for multi-school growth.

When to do:

```text
Start immediately during Phase 2A/2B development.
```

High-growth tables:

```text
students
attendance_sessions
attendance_records
invoices
invoice_lines
payments
receipts
cashier_closes
journal_entries
journal_lines
audit_logs
notification_deliveries
activity_posts
activity_attachments
mark_entries
report_cards
payroll_runs
payroll_lines
messages
transport_logs
file_assets
```

Implementation tasks:

```text
1. Review every list endpoint for pagination.
2. Add server-side filtering for date/class/section/status/search.
3. Add indexes for tenant-scoped query patterns.
4. Add composite uniqueness where duplicates are dangerous.
5. Add tenantId to missing tenant-owned entities if any are found.
6. Add tests that verify cross-tenant access is rejected.
7. Add slow-query logging configuration for staging.
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

Module-specific checks:

```text
M1 Students: tenantId + classId + sectionId + lifecycleStatus + search fields
M2 Attendance: tenantId + date + class/section + session uniqueness
M3 Fees: tenantId + invoice/payment/receipt status and dates
M4 Academics: tenantId + examTerm + class/section + subject + student
M6 Timetable: tenantId + academicYear + class/section + teacher + time slot
M7 Payroll: tenantId + payroll month/status/staff
M9 Accounting: tenantId + fiscal year/period + journal source + posted date
M10 Notices: tenantId + audience + priority + createdAt/read status
```

Exit criteria:

```text
- All new Phase 2 list APIs are paginated.
- All high-growth queries have matching indexes.
- Cross-tenant tests exist for critical modules.
- No frontend list depends on loading all rows.
```

---

## Phase S2 — API/Worker Separation and Queue Discipline

**Goal:** Keep API requests fast by moving slow or retryable work out of request-response.

When to do:

```text
Before broad pilot or before enabling report-heavy Phase 2 workflows.
```

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

Synchronous request is allowed only when:

```text
- the operation is fast,
- must be transactional,
- user needs immediate confirmation,
- failure should block the business action.
```

Queue required when:

```text
- external provider call is involved,
- PDF/report may take more than a few seconds,
- work is retryable,
- work can be done after commit,
- work fans out to many guardians/students/staff,
- work needs scheduled retry/backoff.
```

Implementation tasks:

```text
1. Add explicit worker bootstrap/entrypoint.
2. Separate API process from queue processors in deployment docs.
3. Define queue names by module.
4. Add idempotency keys for retryable jobs.
5. Add dead-letter/failure visibility in Platform Control Plane later.
6. Ensure provider failures do not rollback core school transactions.
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

---

## Phase S3 — Caching and Read Model Strategy

**Goal:** Avoid recalculating dashboard and operational summaries repeatedly.

When to do:

```text
After Phase S1 indexing and before multi-school production rollout.
```

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

Implementation tasks:

```text
1. Add cache wrapper/helper with tenant-aware key naming.
2. Add TTLs and invalidation rules.
3. Cache dashboard summaries, not source-of-truth rows.
4. Use Redis latest-value cache for transport GPS later.
5. Add tests for stale-cache-sensitive workflows.
```

Exit criteria:

```text
- Dashboard pages do not run heavy aggregate queries repeatedly.
- Cache keys are tenant-scoped.
- Financial/accounting source of truth remains PostgreSQL.
- Cache invalidation rules are documented per module.
```

---

## Phase S4 — Observability, Operational Safety, and Release Gates

**Goal:** Know when the system is slow, broken, unsafe, or overloaded.

When to do:

```text
Before charging schools commercially.
```

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

Implementation tasks:

```text
1. Add request/correlation ID middleware.
2. Include request ID in API responses and logs.
3. Add structured logger.
4. Add queue failure logging with job metadata.
5. Add platform health dashboard later.
6. Add daily backup status visibility.
7. Add deployment checklist requiring smoke and readiness.
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

Exit criteria:

```text
- Every production error can be traced using request ID.
- Readiness fails if DB/Redis are unhealthy.
- Failed jobs are visible.
- Staging release is blocked if verification fails.
```

---

## Phase S5 — File Storage and Media Scaling

**Goal:** Prevent uploaded files and generated PDFs from breaking server storage.

When to do:

```text
Before enabling large activity media, student photo upload, homework attachments, or broad certificate/report-card generation.
```

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

Exit criteria:

```text
- Local storage is not the long-term production dependency.
- Files are tenant-scoped.
- Signed downloads are permission-checked.
- Large uploads do not pass through fragile server memory paths where avoidable.
```

---

## Phase S6 — Horizontal Scaling

**Goal:** Run multiple API instances and separate worker instances safely.

When to do:

```text
When more than one school is active or when API latency rises during peak usage.
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

Exit criteria:

```text
- API can be scaled from 1 to 2+ instances safely.
- Workers can be scaled independently by queue pressure.
- Scheduled jobs do not run multiple times accidentally.
- Readiness works per instance.
```

---

## Phase S7 — High-Volume Module Specialization

**Goal:** Optimize modules that naturally create heavy write/read pressure.

Do this only after S1-S6.

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

Exit criteria before microservice extraction:

```text
- Clear bottleneck exists.
- Module has stable API boundary.
- Data ownership is clear.
- Events/outbox pattern is ready.
- Team/deployment benefit exceeds complexity.
```

---

## Phase S8 — Data Partitioning, Archival, and Reporting Scale

**Goal:** Keep long-term data growth manageable.

When to do:

```text
After real production data begins accumulating.
```

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

Exit criteria:

```text
- Old data remains available but does not slow daily workflows.
- Reports are reproducible and audited.
- Exports do not block API request threads.
```

---

## 6. Module-by-Module Scalability Rules

## M0 Platform Core

Scalability focus:

```text
tenant onboarding
plan limits
usage tracking
platform health
support override audit
provider health
queue failure visibility
```

Must implement:

```text
- Platform permissions separate from tenant roles.
- Audit all support/tenant override actions.
- Track per-tenant usage counters gradually.
- Add platform health dashboard once workers/providers are active.
```

## M1 Admissions & Student Profiles

Scalability focus:

```text
student search
student documents
guardian relationships
student lifecycle audit
certificate generation
```

Must implement:

```text
- Paginated student directory.
- Indexed search by tenant/class/section/status.
- Object storage-backed photos/documents.
- Background batch certificate generation.
- Cross-tenant access tests.
```

## M2 Attendance

Scalability focus:

```text
daily bulk writes
monthly registers
history reports
offline sync/conflict handling
```

Must implement:

```text
- Unique tenant/date/class/section session rule.
- Bulk insert/update transactions.
- Monthly reports generated efficiently.
- Index by tenant/date/class/section/student.
- Future offline sync queue or conflict review model.
```

## M3 Fees & Receipts

Scalability focus:

```text
invoice generation
payment collection
cashier close
receipt PDFs
defaulter reports
ledger posting
```

Must implement:

```text
- Decimal-only money handling.
- Transactional payment + receipt + ledger posting.
- Background billing runs for large schools.
- Indexed invoice/payment/receipt queries.
- Idempotency for payment/posting operations.
- Strict audit for reversals/refunds/cashier close.
```

## M4 Exams/CAS/Report Cards

Scalability focus:

```text
marks entry
CAS records
report card generation
promotion readiness
parent result delivery
```

Must implement:

```text
- Tenant/class/section/term/subject indexes.
- Batch marks entry with validation.
- Locking workflow and audit.
- Background report card PDF generation.
- Result publish workflow with notifications queued.
```

## M5 Activity Feed & Milestones

Scalability focus:

```text
media uploads
class/section targeting
guardian visibility
low-bandwidth experience
```

Must implement:

```text
- Object storage and signed previews.
- Media compression queue.
- Tenant/audience scoped reads.
- Pagination/infinite scroll.
- Consent-aware delivery.
```

## M6 Homework & Timetable

Scalability focus:

```text
teacher conflict detection
timetable versions
substitutions
homework attachments
submission tracking
```

Must implement:

```text
- Teacher/room/time conflict indexes.
- Timetable versioning.
- Effective-from dates.
- Publish/lock/archive workflow.
- Substitution checks against leave and availability.
- Attachment storage via File Registry.
```

## M7 HR & Payroll

Scalability focus:

```text
staff contracts
leave
payroll runs
payslip PDFs
accounting posting
```

Must implement:

```text
- Payroll run status machine.
- Payroll posting through accounting boundary only.
- Decimal-safe calculations.
- Background payslip generation.
- Audit approval/posting/void actions.
```

## M8A Library

Scalability focus:

```text
catalog search
copy tracking
issue/return/overdue jobs
```

Must implement:

```text
- Indexed book/copy search.
- Unique copy barcode per tenant.
- Scheduled overdue calculation.
- Fine posting through finance/accounting boundary if used.
```

## M8B Transport

Scalability focus:

```text
route setup
student stop assignment
driver trips
latest GPS
parent bus tracking
ETA
```

Must implement:

```text
- Store latest GPS in Redis.
- Persist trip history in PostgreSQL with retention/partition strategy.
- Use WebSocket/SSE with Redis Pub/Sub when multiple API instances exist.
- Do not let GPS writes overload the main transactional API.
- Future device/geofence/overspeed features should be isolated behind transport boundaries.
```

## M8C Canteen

Scalability focus:

```text
meal plans
QR/student ID serving
wallet
POS sales
low balance alerts
inventory later
```

Must implement:

```text
- Wallet ledger with immutable movements.
- QR serving idempotency.
- Parent spending controls cached carefully.
- Low-balance notifications queued.
- AccountingPostingService integration for financial movements.
```

## M9 Accounting & Finance

Scalability focus:

```text
immutable ledger
journal lines
period close
financial reports
source document links
```

Must implement:

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

Scalability focus:

```text
recipient fanout
delivery retries
read tracking
parent-teacher chat later
quiet hours
```

Must implement:

```text
- Queue all external delivery work.
- Store delivery status per recipient/channel.
- Retry with backoff.
- Respect quiet hours and school-configured chat hours.
- Use Redis unread counters only as cache, not source of truth.
```

---

## 7. Scalability Gate for Every New Feature

Before implementing any feature, answer:

```text
1. Which tenant owns this data?
2. Which role/permission can access it?
3. Is the list paginated?
4. Which index supports the main query?
5. Does the write need a transaction?
6. Is the operation idempotent?
7. Should this be sync or queued?
8. Does it require audit logging?
9. Does it affect accounting/ledger?
10. What tests prove tenant isolation and permissions?
```

Feature is not production-ready until these are answered.

---

## 8. Codex / AI Agent Implementation Prompt Template

Use this for future implementation phases:

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md

Task:
[exact feature/change]

Scalability requirements:
- Keep NestJS modular monolith.
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
- Scalability decisions made
- Tests run
- Verification results
- Remaining risks
```

---

## 9. Recommended Immediate Next Implementation Order

Do next:

```text
1. Keep Phase 2A Academics vertical focused.
2. Add scalability review to Academics: indexes, pagination, report card PDF queue decision, marks-entry tenant tests.
3. Separate API and worker entrypoint before heavy report/PDF usage.
4. Add request/correlation ID logging.
5. Add queue failure visibility for notifications/reports.
6. Harden object storage before student photo/activity/homework uploads expand.
7. Keep Transport/Canteen production work later until core Phase 2 verticals are stable.
```

Avoid now:

```text
❌ Angular migration
❌ AI/ML features
❌ Transport GPS production build before Redis/WebSocket scaling plan
❌ Canteen wallet before accounting boundaries are hardened
❌ Microservices
❌ Broad Phase 2 expansion across every module at once
```

---

## 10. Final Rule

SchoolOS becomes scalable by making every development phase production-aware.

```text
Build feature -> enforce tenant isolation -> index queries -> paginate lists -> queue slow work -> audit sensitive actions -> verify with tests -> only then move to next feature.
```

Scalability is not a separate final task. It is a rule applied during every module implementation from this point onward.
