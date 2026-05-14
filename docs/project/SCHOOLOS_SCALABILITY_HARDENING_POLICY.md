# SchoolOS Scalability Hardening Policy

**Status:** Documentation policy / implementation guide  
**Applies to:** M0 Platform and M1-M11 school modules  
**Architecture:** PostgreSQL-first, NestJS modular monolith, Redis/BullMQ, private object storage

This document records how SchoolOS should scale as traffic and school count increase. It is intentionally a policy, not a one-time implementation sprint.

SchoolOS must not implement scalability as one risky broad rewrite. Scalability hardening must be applied gradually as each module or phase is touched.

---

## 1. Core Decision

SchoolOS remains:

```text
PostgreSQL-first
Modular-monolith-first
TenantId-scoped
Backend-enforced
Queue-assisted
Object-storage-backed
```

Do not add MongoDB, microservices, Elasticsearch/OpenSearch, or broad infrastructure changes just because the product may scale later.

Use this order:

```text
1. PostgreSQL indexes
2. Query optimization
3. Pagination everywhere
4. BullMQ background jobs for slow/retryable work
5. File Registry and object storage for files
6. Retention and archival policies
7. Redis caching only where safe
8. PostgreSQL search
9. PostgreSQL read replicas later
10. Table partitioning later
11. Search engine much later if PostgreSQL search becomes insufficient
```

---

## 2. Near-Term Implementation Order

For the current SchoolOS phase, use this practical order:

```text
1. Index + pagination audit
2. Query optimization
3. BullMQ for heavy work
4. File Registry/object storage enforcement
5. Retention jobs
6. Redis caching
7. PostgreSQL search
8. Read replicas later
9. Partitioning later
10. Search engine much later
```

This means:

- Implement indexes and pagination when touching an endpoint.
- Queue heavy report/PDF/export/provider/media work when converting or hardening that workflow.
- Enforce File Registry/object storage when a module touches files.
- Add retention policies for high-volume operational tables.
- Add Redis cache only for safe read-heavy data.
- Delay read replicas, partitioning, and search engine until real traffic proves the need.

---

## 3. Non-Negotiable Scalability Checklist

Every future module task must answer these questions before it is considered production-ready:

```text
1. Which module owns this feature: M0 or M1-M11?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Which list/query can grow?
6. Is every growing list paginated and filterable?
7. Which PostgreSQL index supports the main query?
8. Does the index include tenantId for tenant-owned data?
9. Is the response too large or over-including related data?
10. Is there any N+1 query pattern?
11. Does the write need a transaction?
12. Is the operation idempotent or retry-safe?
13. Should the operation be sync or queued through BullMQ?
14. Does it generate a PDF, export, media, or report snapshot?
15. Should generated files go through File Registry/object storage?
16. Does it need Redis cache?
17. What invalidates the cache?
18. Does it need a retention/archive policy?
19. Does it affect accounting or ledger records?
20. Does it require audit logging?
21. What tests prove tenant isolation, permissions, pagination, and retry safety?
```

---

## 4. PostgreSQL Index Policy

PostgreSQL remains the source of truth. Add indexes only for real query patterns.

Common tenant-scoped index patterns:

```text
tenantId + createdAt
tenantId + updatedAt
tenantId + status
tenantId + studentId
tenantId + staffId
tenantId + classId
tenantId + sectionId
tenantId + date
tenantId + fiscalYearId
tenantId + sourceType + sourceId
tenantId + module + status
tenantId + usageKey + period
```

Priority tables for index review as modules are touched:

```text
Student
AdmissionApplication
AttendanceRecord
FeeInvoice
FeePayment
Receipt
AccountingJournal
AccountingJournalLine
AuditLog
NotificationDelivery
FileAsset
ActivityPost
Homework
TimetableSlot
PayrollRun
LibraryIssue
LibraryFine
CanteenWalletTransaction
CanteenSale
TransportTrip
TransportLocationPing
TenantSubscription
SaaSInvoice
UsageCounter
```

Rules:

- Do not add random indexes.
- Avoid overlapping indexes that support the same query.
- Add indexes close to the feature work that needs them.
- Keep query filters aligned with indexes.
- Prefer tenantId-first indexes for tenant-owned tables.

---

## 5. Pagination and Query Optimization Policy

Every growing list endpoint must support pagination.

Default filters to consider:

```text
page
limit
search
status
dateFrom
dateTo
classId
sectionId
studentId
staffId
fiscalYearId
sort
```

Avoid:

```text
findMany without take/skip/cursor for growing tables
frontend-only filtering of large datasets
large include trees that load unrelated data
N+1 service loops
report calculations only in React
unbounded CSV/PDF exports
```

Small static lookup endpoints may remain unpaginated only when the dataset is intentionally small.

---

## 6. Redis Caching Policy

Redis is for speed and operational state, not financial truth.

Safe cache candidates:

```text
tenant settings
active academic year
platform plan/features
entitlement check result with short TTL
session/permission metadata where safe
dashboard summaries where stale data is acceptable
transport latest location
short-lived report preview status
rate-limit counters
```

Do not cache as source of truth:

```text
payments
receipts
accounting ledger writes
payroll posting state
confirmed invoices
journal entries
final report-card records
```

Rules:

- Cache keys must include tenantId when data is tenant-owned.
- Every cache must have a TTL.
- Writes that change settings/plans/entitlements must invalidate or bypass related caches.
- Cache is an optimization; PostgreSQL remains source of truth.

---

## 7. BullMQ Background Job Policy

Slow, retryable, provider-dependent, or batch work should move to BullMQ.

Queue candidates:

```text
notification delivery
SMS/email/push provider calls
PDF generation
large report generation
CSV exports
activity media compression
homework attachment processing
report-card batch generation
payroll batch generation
fee defaulter aging exports
object-storage cleanup
transport GPS retention cleanup
provider retry workflows
```

Rules:

- Jobs must be tenant-scoped where tenant-owned.
- Jobs that can be retried must be idempotent.
- Financial/accounting jobs must avoid duplicate posting.
- Queue payloads must not expose secrets.
- Retry/discard actions must be permissioned and audited.

---

## 8. File Registry and Object Storage Policy

Do not store files in PostgreSQL. Do not store permanent public URLs.

Use File Registry/object storage for:

```text
student documents
student photos
ID cards
receipts
report cards
payslips
activity media
homework attachments
library/canteen/transport exports
audit/report snapshots
```

Database stores metadata only:

```text
tenantId
module/owner type
owner id
object key
mime type
size
visibility/access policy
createdBy
createdAt
```

Rules:

- Use signed URLs or protected API access.
- Tenant isolation is mandatory.
- Sensitive downloads should be audited.
- Staging object-storage readiness must be verified before pilot.

---

## 9. Retention and Archival Policy

High-volume operational data needs retention. Legal/financial records need preservation.

Examples:

```text
Transport GPS pings: keep detailed pings for a limited operational window, then clean/archive.
Temporary exports: expire after a short configured period.
Notification delivery logs: archive after the configured retention period.
Completed/failed jobs: clean after a safe operational period.
Activity media: follow school-configured retention and consent rules.
Audit logs: retain long-term according to compliance policy.
Fees/accounting/payroll: archive if needed, do not delete financial truth.
```

Rules:

- Do not delete accounting, fee, payroll, or legal records casually.
- Prefer archive/soft-delete for business records.
- Cleanup jobs must be tenant-safe and batch-safe.
- Retention decisions must be documented in the owning module.

---

## 10. Search Policy

Use PostgreSQL search first.

Near-term search tools:

```text
indexed exact match
ILIKE for small/medium controlled lists
PostgreSQL full-text search
PostgreSQL trigram indexes later
```

Good PostgreSQL search targets:

```text
student search
guardian phone search
receipt/invoice search
platform tenant search
library book/borrower search
audit search
file/export search
```

Do not add Elasticsearch/OpenSearch until PostgreSQL search is clearly insufficient for real production load.

---

## 11. Future Scale Options

These are future options, not current implementation tasks.

### Read replicas

Use later for report-heavy workloads when primary database read load becomes a bottleneck.

### Table partitioning

Use later for very large tables such as:

```text
AuditLog
AttendanceRecord
NotificationDelivery
TransportLocationPing
ActivityPost
AccountingJournalLine
UsageCounter
```

Partitioning should follow proven access patterns, such as tenant/date, month, academic year, or fiscal year.

### Search engine

Use later only if PostgreSQL full-text/trigram search cannot support required global/fuzzy search performance.

### Microservices

Use later only for scale/team/deployment/compliance reasons. Do not split services just to mirror product modules.

---

## 12. How to Use This in Future Prompts

Add this line to future Codex tasks:

```text
Also apply the SchoolOS scalability checklist: index review, pagination, query optimization, queue decision, File Registry/object storage decision, retention decision, Redis cache decision, PostgreSQL search decision, and tenant-isolation tests.
```

For each task, return:

```text
- Scalability decisions made
- Indexes added or reviewed
- Pagination/query changes
- Queue/cache/file/retention decisions
- Tests proving tenant isolation and permissions
- Remaining scale gaps
```
