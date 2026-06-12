# SchoolOS Cost and Performance Implementation Plan

**Last updated:** 2026-06-13  
**Status:** Active implementation plan for minimizing compute, storage, bandwidth, notification, report, and future AI cost without degrading user-perceived speed.  
**Applies to:** NestJS API, Next.js dashboard, Flutter companion app, PostgreSQL/Prisma, Redis/BullMQ, File Registry, private object storage, provider adapters.

---

## 1. Goal

SchoolOS must stay fast on low-resource infrastructure by removing waste before increasing server size.

Primary goal:
```text
Keep SchoolOS affordable to run for early Nepal school pilots while preserving fast dashboards, safe data access, reliable reports, and smooth mobile usage.
```

This plan turns the architecture policy into implementation work. It does not approve microservices, Kubernetes, broad AI scope, or expensive real-time systems.

---

## 2. Core Strategy

Use this optimization order:

```text
1. Tenant-scoped database efficiency
2. Pagination and payload control
3. File/image compression and object storage
4. Background jobs for heavy work
5. Summary tables for dashboards
6. Selective cache for read-heavy low-risk data
7. Notification channel control
8. Controlled logs and retention
9. Selective real-time only where needed
10. Async/human-reviewed AI only after real data exists
```

Do not add infrastructure before checking whether the issue is caused by:
- Missing indexes.
- Unpaginated queries.
- Over-fetching API payloads.
- Original images served to dashboards/mobile.
- Synchronous PDF/report generation.
- Repeated dashboard calculations from raw tables.
- Excessive SMS usage.
- Noisy logs.
- Unnecessary real-time subscriptions.

---

## 3. Phase 1 — Immediate Low-Resource Guardrails

### 3.1 Database and API Guardrails

Tasks:
- Audit growing list endpoints for pagination.
- Ensure every tenant-owned query filters by `tenantId`.
- Add or verify compound indexes for high-volume query patterns.
- Replace frontend-side filtering of growing datasets with server-side filtering.
- Ensure list APIs return summary DTOs, not full detail payloads.

Priority query patterns:
```text
tenantId + studentId
tenantId + classId
tenantId + sectionId
tenantId + date
tenantId + status
tenantId + createdAt
tenantId + fiscalYearId
tenantId + module/source/status
```

Acceptance criteria:
- No growing list endpoint uses unbounded `findMany`.
- Common list APIs use `take`, cursor, or page/limit.
- API response payloads only include fields needed by that screen.
- Tenant isolation tests still pass.

### 3.2 File and Image Guardrails

Tasks:
- Enforce File Registry + StorageService path for all production files.
- Block base64 file storage in PostgreSQL.
- Add image variant generation for profile photos, logos, activity images, and notice images.
- Use thumbnails for tables/lists and display variants for detail views.
- Keep originals only when required for audit, document fidelity, or regeneration.

Recommended variants:

| File type | Variants |
|---|---|
| Profile photo | `thumbnail-128`, `display-512` |
| School logo | SVG preferred; otherwise `display-512` |
| Notice/activity image | `thumbnail-256`, `display-1200` |
| Document scan | `preview-1600` or `preview-2000`; original if required |
| Generated PDF | Stored once and reused until source data changes |

Acceptance criteria:
- Normal UI never loads original uploaded photos.
- File metadata records tenant, owner, module, size, MIME type, and variant type.
- Upload succeeds but DB save fails -> cleanup or orphan marking exists.
- DB save succeeds but upload fails -> incomplete/failed state is visible.

### 3.3 Background Work Guardrails

Tasks:
- Move slow, retryable, provider-dependent, report, PDF, export, image-processing, and batch-notification work into BullMQ.
- Ensure jobs are tenant-scoped and idempotent.
- Add job status records for user-visible report/export tasks.

Acceptance criteria:
- Report/export endpoints enqueue work and return job status instead of blocking.
- Retried jobs do not duplicate financial records, notifications, files, or reports.
- Failed jobs show safe diagnostics without secrets.

---

## 4. Phase 2 — Dashboard Speed Without High Compute

### 4.1 Summary Tables

Create or verify summary paths for high-traffic dashboards:

| Summary | Purpose |
|---|---|
| `student_attendance_summary` | Student attendance percentage and recent status |
| `student_fee_summary` | Due amount, paid amount, last payment, overdue state |
| `student_exam_summary` | Latest average/grade/report status |
| `class_attendance_summary` | Daily class present/absent totals |
| `class_performance_summary` | Exam/class-level analytics |
| `school_dashboard_summary` | Admin dashboard KPIs |
| `tenant_usage_summary` | Storage, SMS, report, and future AI usage visibility |

Tasks:
- Identify dashboard cards that currently calculate from raw records.
- Replace repeated raw scans with summary reads.
- Update summaries transactionally when simple and deterministic.
- Use scheduled/event-triggered jobs for heavier summaries.

Acceptance criteria:
- Admin dashboard summary loads from precomputed or cached summary data.
- Parent/student dashboard does not scan full attendance, fee, and exam history on first load.
- Summary freshness is visible where needed through `lastUpdatedAt`.

### 4.2 Frontend Lazy Loading

Tasks:
- Load only the first visible dashboard state immediately.
- Lazy-load charts, historical tables, report histories, and detail panels.
- Use skeleton states for perceived speed.
- Keep route-based code splitting in the Next.js dashboard.

Acceptance criteria:
- Dashboard first visible state appears quickly even when heavy panels are pending.
- Tables do not fetch all data when the tab is not open.
- Mobile screens use purpose-limited API responses.

---

## 5. Phase 3 — Notification and Provider Cost Control

### 5.1 Channel Policy

Default channel order:
```text
In-app -> push -> email -> SMS
```

Tasks:
- Categorize notification types by urgency.
- Use SMS only for approved high-priority categories.
- Add batching for attendance, fee reminders, and bulk notices.
- Track delivery status and retries through provider-safe logs.

SMS-eligible categories:
- Absence alert when school enables SMS.
- Emergency notice.
- Login/security OTP.
- Fee overdue escalation after cheaper channels fail or policy requires SMS.
- Critical account/payment event.

Avoid SMS for:
- Routine homework updates.
- Normal notices.
- General activity posts.
- Marketing or low-priority reminders.

Acceptance criteria:
- Notification category decides the default channel.
- SMS usage is counted by tenant and period.
- Failed provider calls do not block core school workflows.

### 5.2 Provider Modes

Provider modes:
```text
disabled
log/dev
mock
configured
```

Tasks:
- Ensure pilot environments use disabled/log/mock unless real provider approval exists.
- Make provider state visible in platform diagnostics.
- Fail safely when a provider is not configured.

Acceptance criteria:
- System does not pretend to send real messages in disabled/mock mode.
- Provider failures produce safe operational diagnostics.

---

## 6. Phase 4 — Report, Export, and File Lifecycle Control

Tasks:
- Generate report cards, receipts, exports, and accounting snapshots once.
- Store generated files in private object storage with File Registry metadata.
- Reuse generated files until source data changes or explicit regeneration is requested.
- Add temporary export expiration policy.
- Add orphaned file cleanup job.

Acceptance criteria:
- Re-downloading a report does not regenerate it unnecessarily.
- Temporary exports expire by policy.
- Financial/accounting snapshots remain immutable or versioned where required.
- Cleanup jobs never delete legal, financial, payroll, attendance, or audit records casually.

---

## 7. Phase 5 — Selective Cache and Real-Time Control

### 7.1 Cache

Good cache candidates:
- School settings.
- Active academic year.
- Platform plans and entitlements.
- Class/section lookup data.
- Dashboard summaries with short TTL.

Do not use cache as source of truth for:
- Payments.
- Receipts.
- Accounting ledgers.
- Payroll postings.
- Critical authorization decisions without backend verification.

Acceptance criteria:
- Cache keys include `tenantId`.
- TTL is explicit.
- Cache miss falls back safely to PostgreSQL.

### 7.2 Real-Time

Allowed or likely justified:
- Attendance session state.
- Critical operational alerts.
- Admin-only transport latest location after load testing.
- Chat only after retention/access/abuse policies are approved.

Prefer polling/manual refresh for:
- Fee dashboards.
- Exam dashboards.
- Student lists.
- Notice lists.
- Report/export history.

Acceptance criteria:
- New real-time feature documents why polling is not enough.
- Real-time connection/fanout metrics are observable.
- Suspended tenants and disabled features fail closed for real-time subscriptions.

---

## 8. Phase 6 — Future AI/Automation Cost Control

M11 Intelligence remains roadmap-only unless explicitly approved.

When introduced:
- Run scoring asynchronously on a schedule or after source data changes.
- Store latest result with generation time and explanation metadata.
- Track per-tenant usage.
- Keep teacher/admin review for student-impacting outputs.
- Start with rules and aggregates before LLM/GPU-heavy workflows.

Acceptance criteria:
- No AI inference runs on every normal page load.
- Usage is countable per tenant.
- Outputs are explainable and human-reviewed where required.

---

## 9. Performance Budgets

Use these targets for pilot/staging unless the module documents a stronger reason:

| Area | Target |
|---|---:|
| Simple lookup API | Under 200 ms server processing |
| Growing list API | Under 300-700 ms with pagination/filtering |
| Admin dashboard summary API | Under 500 ms with summaries/caching where practical |
| Common database query | Usually under 100-200 ms |
| API page size | 20-100 records |
| Profile display image | Under 300 KB |
| Thumbnail image | Under 60 KB |
| Report/PDF generation | Background job |
| Large import/export | Background job with status |
| Mobile first-visible state | Fast skeleton/partial data first |

A module that repeatedly exceeds these budgets should be optimized before infrastructure is increased.

---

## 10. Cost Readiness Checklist for New Features

Before marking a feature production-ready, answer:

1. Does it stay inside the modular monolith?
2. Are all queries tenant-scoped?
3. Is every growing list paginated?
4. Which index supports the main query?
5. Is the response payload purpose-limited?
6. Does heavy work run in BullMQ?
7. Are jobs idempotent and tenant-scoped?
8. Are files stored through File Registry and StorageService?
9. Are image variants generated where applicable?
10. Are reports generated once and reused?
11. Can in-app/push/email replace SMS?
12. Is real-time truly required?
13. Is AI truly required now?
14. Is logging useful without leaking or overproducing data?
15. What metric proves the feature is fast enough?
16. What quota or usage counter controls platform cost?

---

## 11. Recommended First Implementation Sequence

1. Audit list endpoints for pagination and tenant indexes.
2. Add image variant generation and ensure UI uses variants.
3. Enforce object storage metadata and no-base64 database rule.
4. Convert report/export generation to queue-backed workflows.
5. Add dashboard summary tables/jobs for admin, student, attendance, and fees.
6. Add notification category/channel policy and tenant usage counters.
7. Add platform usage dashboard for storage, SMS, reports, queues, and provider health.
8. Add cache only for settings, entitlements, lookup data, and short-lived summaries.
9. Review real-time features and remove/avoid unnecessary subscriptions.
10. Keep AI deferred until production data and cost controls exist.

---

## 12. Non-Negotiable Rules

- No unpaginated growing list endpoints.
- No original image serving in normal UI.
- No base64 files in PostgreSQL.
- No heavy report/export/PDF generation inside request-response flows.
- No dashboard raw-table scans on every page load.
- No SMS for low-priority notifications.
- No real-time subscriptions without workflow justification.
- No AI inference on every page load.
- No new infrastructure to hide inefficient code.
- No cross-tenant data or file access under any cost optimization.
