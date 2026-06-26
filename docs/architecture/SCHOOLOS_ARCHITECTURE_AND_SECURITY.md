# SchoolOS Architecture and Security

**Status:** Canonical SDD
**Owner/audience:** CTO, lead NestJS developer, lead Next.js developer, senior Flutter developer, database designer, PostgreSQL DBA, security engineer, QA lead, DevOps/SRE, support/operations lead
**Scope:** Architecture, service/module boundaries, data model direction, integration boundaries, runtime topology, authorization, security, files, queues, notifications, performance, backup/recovery, and operational design.
**Precedence:** This document owns architectural rules and design constraints. Software requirements are owned by `../requirements/SCHOOLOS_SRS.md`; module design by `SCHOOLOS_MODULE_DESIGN_CATALOG.md`; product/functional behavior by `../product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` and `../product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; current readiness by `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
**Inputs/source documents:** `../product/SCHOOLOS_BRD.md`, `../product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `../product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`, `../requirements/SCHOOLOS_SRS.md`, `SCHOOLOS_MODULE_DESIGN_CATALOG.md`, `SCHOOLOS_NOTIFICATION_ARCHITECTURE.md`, `SCHOOLOS_PLATFORM_OPERATIONS.md`, `../production/SCHOOLOS_GA_RELEASE_POLICY.md`, repository source inspected on 2026-06-20.
**Out-of-scope content:** Endpoint URL invention, Prisma migrations for proposed structures, UI visual detail, staging credentials, and GA readiness claims.
**Last reviewed date:** 2026-06-26
**Architecture:** PostgreSQL-first, NestJS modular monolith, Redis/BullMQ, private object storage, cost-aware performance budgets.

---

## 1. Active Module Numbering

| Module | Name |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
| M4 | Academics, Exams, CAS, Report Cards |
| M5 | Activity Feed and Milestones |
| M6 | Homework and Timetable |
| M7 | HR and Payroll |
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M11 | Accounting and Finance |
| M12 | Notifications, Notices, Communication, Chat |
| M13 | Learning Layer |
| M14 | Intelligence / AI |

`M8A`, `M8B`, and `M8C` are obsolete labels. Library, Transport, and Canteen are standalone modules.

Inventory & Asset Management is not active scope.

---

## 1A. Stage-Aware Shared-Core Architecture

SchoolOS must support `PRESCHOOL`, `SCHOOL`, `HIGHER_SECONDARY`, and `BACHELOR` direction over one shared core, not as separate products or data systems.

Master's is not an active full institution-management pack. It is a future extension and an allowed Student App eligibility level only.

The shared record model remains:

```text
Student
+ Guardian relationship
+ Student enrollment
+ Academic year
+ Class/section
+ stage/program classification
+ role and permission scope
+ enabled module/capability
```

Current code evidence shows shared `Tenant`, `Student`, `Guardian`, `StudentGuardian`, `Enrollment`, `AcademicYear`, `Class`, `Section`, and `Subject` models. A canonical program-offering, class stage profile, Bachelor program/course/term model, Master eligibility model, stream/subject-combination model, pickup/drop workflow model, broad Student App eligibility guard, and `ExperienceContext` contract were not verified in this pass and are therefore **proposed / needs schema design** unless explicitly marked out of scope.

Backend-owned experience resolution must eventually derive from:

```text
Tenant program offerings
+ platform module entitlement
+ school-level configuration
+ class/section stage or program
+ active enrollment
+ user role
+ permission
+ teacher assignment
+ guardian-child relationship
+ enabled capability
```

The SRS owns the conceptual system diagram, non-functional requirements, data lifecycle matrix, and quality/operations matrix. The MDD owns module-stage applicability and the code-evidence gap matrix.

Required architecture guardrails for proposed stage-aware work:

1. Do not add `PreschoolStudent`, `SchoolStudent`, `PlusTwoStudent`, `BachelorStudent`, `MasterStudent`, or a separate app/database.
2. Extend the shared tenant/student/enrollment/academic model only through reviewed schema design, migration replay, OpenAPI/shared DTO updates, web/mobile contract updates, and tests.
3. Preschool pickup/drop, authorized pickup, temporary pickup changes, and care alerts must be narrow, auditable, and permission-scoped.
4. Higher Secondary streams, subject combinations, practicals, projects, and lab timetables must be school-configurable, not hard-coded.
5. Backend authorization must enforce the active experience independently of UI composition.
6. Broad Student App authorization must be backend-owned and allowed only for active Bachelor or Master enrollments; Preschool through Grade 12 remain controlled learning/session only.
7. Do not add Master's administration, academic structure, finance, faculty, or course-management features without separate approval.

## 2. Storage and File Registry Architecture

### Global Rule

Every module that creates, uploads, previews, downloads, exports, or deletes a file must follow this path:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

Never do this inside a feature module:

- AWS SDK / GCP SDK imports.
- R2 manual signing or MinIO direct client.
- `fs.writeFile` for production files.
- Hardcoded provider URLs or permanent public URLs as source of truth.

Storage providers are infrastructure details. SchoolOS modules must use `FileRegistryService` and `StorageService`, not provider SDKs directly.

### Goal

SchoolOS must support changing storage providers without rewriting module code.

Supported target providers:

```text
local disk
Cloudflare R2
AWS S3
MinIO
GCP Cloud Storage
S3-compatible providers
```

Changing provider should normally require only:

1. Update environment variables.
2. Verify provider readiness.
3. Run migration/copy jobs if existing objects must move.
4. Keep object keys and File Registry metadata stable.

Modules such as Students, Activity Feed, Notices, Homework, Payroll, Accounting, Library, Canteen, Transport, Learning, and mobile must not know whether the backing platform is R2, S3, GCP, MinIO, or local disk.

### Target Architecture

```text
SchoolOS modules
Students / Activity / Notices / Homework / PDFs / Reports / Chat / Library / Canteen / Transport / Learning
        |
        v
FileRegistryService
        |
        v
StorageService
        |
        v
StorageAdapter interface
        |
        +-- LocalStorageAdapter
        +-- S3CompatibleStorageAdapter
        +-- GcpStorageAdapter
```

Rules:

- `FileRegistryService` owns file metadata, permissions, ownership, auditability, and lifecycle.
- `StorageService` owns provider selection and stable storage methods.
- `StorageAdapter` owns provider-specific implementation.
- Feature modules must never import AWS, R2, GCP, MinIO, or filesystem clients directly.
- Backend APIs must return file IDs or short-lived signed URLs, not permanent provider URLs as the source of truth.
- All object keys must include `tenantId` and avoid user-controlled raw file names.
- Frontend/mobile must never receive raw object keys unless a contract explicitly marks them safe for display, which should be exceptional.

---

## 3. Module-Wise Storage Ownership

### M0 Platform Core

- Platform settings show provider type, bucket, endpoint readiness, and safe masked status.
- Queue/provider failure dashboard must never expose storage secrets.
- SaaS tenant onboarding checklist should surface object-storage readiness.

### M1 Admissions and Student Profiles

- Files: student photos, student documents, admission documents, guardian documents, student ID card PDF/QR assets, school logo/branding assets.
- Student profile stores file IDs, not provider URLs.
- Document uploads create File Registry records. Photo previews use signed/protected URLs.

### M2 Smart Attendance

- Files: attendance CSV/PDF exports and monthly register exports.
- Retained exports must have File Registry records.

### M3 Fees and Receipts

- Files: receipt PDFs, fee collection reports, cashier close/day-end reports, defaulter aging exports, fee-head/period dues exports.
- Receipt reprints should read from File Registry or regenerate with auditable history.
- Cashier close files must be tenant-scoped. Finance files must never be public.

### M4 Academics, Exams, CAS, Report Cards

- Files: report-card PDFs, academic CSV/PDF reports, result publishing snapshots, correction/regeneration history files, school logo assets.
- Report-card PDFs must be tenant-scoped. Result snapshots must be immutable or versioned.

### M5 Activity Feed and Milestones

- Files: activity media, classroom photos/videos, milestone media, optimized preview variants.
- Activity media is private by default. Parent photo consent must be enforced.

### M6 Homework and Timetable

- Files: homework attachments, student submission attachments, timetable exports, substitution reports.
- Homework attachment reads must fail closed for unlinked parent/student actors.

### M7 HR and Payroll

- Files: staff documents, contracts, payslip PDFs, payroll reports/statutory exports.
- Staff PII and payroll files must be permissioned and audited. Payslips must be tenant-scoped and staff self-service safe.

### M8 Library

- Files: book cover images, barcode/QR label sheets, library reports, fine-to-fees export artifacts.
- Reports must be tenant-scoped.
- Book copy archive is preferred over unsafe deletion when history exists.

### M9 Transport

- Files: vehicle documents, driver/conductor documents where allowed, route/trip reports, GPS history exports.
- GPS latest-location belongs in Redis or purpose-specific latest-state storage. Retained reports/exports use File Registry.

### M10 Canteen

- Files: POS receipts, canteen stock reports, purchase-bill attachments, stock/wastage reports.
- POS receipt PDFs must be tenant-scoped. Purchase-bill attachments must use File Registry.
- Wallet and POS financial proof must be protected.

### M11 Accounting and Finance

- Files: journal exports, trial balance/balance sheet PDFs, bank reconciliation PDFs, saved snapshots, background export artifacts.
- Accounting report snapshots should be immutable/versioned.
- Other modules must not directly write official ledgers from frontend code.

### M12 Notifications, Notices, Communication, Chat

- Files: notice/chat attachments, notification delivery reports, provider failure exports.
- Attachments must use File Registry access rules.
- Chat attachment access must fail closed for unlinked actors.
- Provider secrets, callback payload secrets, raw object keys, and private URLs must never leak.

### M13 Learning Layer

- Files: learning resources, activity attachments, printable worksheets, safe classroom media, and progress/report exports where supported.
- Learning resources must be tenant-scoped and class/session/role scoped.
- Parent summaries must not expose another child's resources or attempts.

### M14 Intelligence / AI

- Roadmap only.
- No AI file, model output, prompt, embedding, or export storage should be added until M14 is explicitly approved.

---

## 4. Database Scaling and Hardening Policy

SchoolOS remains:

```text
Monolith-first
PostgreSQL-first
TenantId-scoped
Backend-enforced
Queue-assisted
Object-storage-backed
```

Do not add microservices, MongoDB, Elasticsearch/OpenSearch, GPU workers, or Kubernetes without explicit approval.

Near-term scalability order:

1. Index and pagination audit.
2. Query optimization and N+1 removal.
3. BullMQ background jobs for heavy report/PDF/export/provider/media work.
4. File Registry/object storage for files.
5. Retention and archival for temporary exports, GPS pings, logs, notifications, and provider diagnostics.
6. Redis caching for low-risk read-heavy settings/platform configuration only.

Common tenant-scoped index patterns:

```text
tenantId + createdAt / updatedAt / status / studentId / staffId / classId / sectionId / date / fiscalYearId
tenantId + sourceType + sourceId
tenantId + module + status
tenantId + usageKey + period
```

Every growing list endpoint must support pagination. Avoid unbounded `findMany` on tenant-owned operational data.

Redis is for speed, not financial truth. Never cache payments, receipts, accounting ledgers, payroll posting states, wallet balances, stock quantities, or notification delivery state as the source of truth.

---

## 5. Cost and Performance Policy

Do not buy more server capacity to hide inefficient architecture. Optimize query shape, indexes, pagination, summaries, payload size, file variants, and background jobs before increasing server size.

Default low-resource architecture:

```text
Next.js dashboard / Flutter app
        ↓
NestJS modular monolith API
        ↓
PostgreSQL with tenant-scoped indexes
        ↓
Private object storage through File Registry
        ↓
Redis + BullMQ for async work
        ↓
Provider adapters for email/SMS/payment/storage
```

Avoid by default:

- Microservices.
- Kubernetes.
- Separate search clusters.
- Separate analytics databases.
- GPU workers.
- Live subscriptions for normal dashboard data.
- AI inference inside request/response flows.

Performance budgets:

| Area | Target |
|---|---:|
| Simple lookup API | Under 200 ms server processing |
| Growing list API | Under 300-700 ms with pagination/filtering |
| Admin dashboard summary API | Under 500 ms using precomputed summaries where practical |
| Database query target | Usually under 100-200 ms for common paths |
| API page size | 20-100 records by default |
| Profile image display variant | Under 300 KB |
| Thumbnail variant | Under 60 KB |
| Report/PDF generation | Background job, not synchronous request |
| Large import/export | Background job with progress/status |
| Mobile first-visible state | Fast skeleton/partial data, then lazy detail load |

---

## 6. Notification Cost Rules

Use the cheapest reliable channel that satisfies the business risk:

```text
In-app notification
-> push notification
-> email
-> SMS only for high-priority or legally/operationally important events
```

SMS should be reserved for:

- Absence alerts where the school has enabled SMS.
- Fee overdue escalation after cheaper channels fail or policy requires SMS.
- Emergency notices.
- Login/security OTP.
- Critical account or payment events.

Provider modes must be explicit:

```text
disabled
log/dev
mock
configured
```

The system must not pretend to send real messages in disabled, log/dev, or mock mode. Provider failures should produce safe diagnostics and must not block core school workflows.

---

## 7. Real-Time and AI Cost Rules

Use real-time only where immediate updates materially improve the workflow, such as live attendance session state, critical admin notifications, admin-only transport latest-location state after load testing, and parent-teacher chat after ownership and retention rules are approved.

Use polling, manual refresh, cached summaries, or scheduled refresh for fee dashboards, exam summaries, student lists, notice lists, report/export history, and static settings.

M14 Intelligence and future AI features must not run expensive inference on every page load.

M14 default policy:

- Run analytics/risk scoring asynchronously on a schedule or after source data changes.
- Store and show latest result with `generatedAt`, model/version/rule metadata, and explanation where practical.
- Use rules/aggregates first; add ML/LLM only when product value and cost controls are clear.
- Keep AI outputs teacher/admin-reviewed for student-facing or parent-facing decisions.
- Track per-tenant AI usage if AI credits or pricing will exist.

---

## 8. Security Non-Negotiables

- No cross-tenant data or file access.
- No frontend-only permission enforcement.
- No unpaginated growing list endpoints.
- No original image serving in normal UI.
- No base64 files in PostgreSQL.
- No heavy report/export/PDF generation inside request-response flows.
- No dashboard raw-table scans on every page load.
- No SMS for low-priority notifications.
- No real-time subscriptions without workflow justification.
- No AI inference on every page load.
- No new infrastructure to hide inefficient code.
- No direct ledger writes from non-M11 frontend code.
- No parent/student/driver/staff self-service admin-shaped payloads.
