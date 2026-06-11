# SchoolOS Architecture and Security

**Last updated:** 2026-06-02  
**Status:** Consolidated source of truth for storage boundaries, database scaling, tenant isolation, and security rules.  
**Architecture:** PostgreSQL-first, NestJS modular monolith, Redis/BullMQ, private object storage.

---

## 1. Storage and File Registry Architecture

### Global Rule
Every module that creates, uploads, previews, downloads, exports, or deletes a file must follow this path:
```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```
Never do this inside a feature module:
- AWS SDK / GCP SDK imports
- R2 manual signing or MinIO direct client
- `fs.writeFile` for production files
- Hardcoded provider URLs or permanent public URLs as source of truth

Storage providers are infrastructure details. SchoolOS modules must use `FileRegistryService` and `StorageService`, not provider SDKs directly.

### Goal
SchoolOS must support changing storage providers without rewriting module code.
Supported target providers: local disk, Cloudflare R2, AWS S3, MinIO, GCP Cloud Storage.
Changing provider should normally require only:
1. Update environment variables.
2. Verify provider readiness.
3. Run migration/copy jobs if existing objects must move.
4. Keep object keys and File Registry metadata stable.

Modules such as Students, Activity Feed, Notices, Homework, Payroll, Accounting, Library, Canteen, Transport, and mobile must not know whether the backing platform is R2, S3, GCP, MinIO, or local disk.

### Target Architecture
```text
SchoolOS modules
Students / Activity / Notices / Homework / PDFs / Reports / Chat / Library / Canteen
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
- `FileRegistryService` owns file metadata, permissions, ownership, auditability, and lifecycle.
- `StorageService` owns provider selection and stable storage methods.
- `StorageAdapter` owns provider-specific implementation.
- Feature modules must never import AWS, R2, GCP, MinIO, or filesystem clients directly.
- Backend APIs must return file IDs or short-lived signed URLs, not permanent provider URLs as the source of truth.

### Storage Adapter Contract
Maintain a provider-neutral contract similar to:
```ts
export type SchoolOSStorageProvider =
  | 'local'
  | 's3'
  | 'r2'
  | 'minio'
  | 'gcp';

export interface PutObjectInput {
  tenantId: string;
  prefix: string;
  fileName: string;
  contentType: string;
  content: Buffer;
}

export interface StoredObjectResult {
  provider: SchoolOSStorageProvider;
  bucket: string | null;
  objectKey: string;
  sizeBytes: number;
  checksumSha256?: string;
  publicUrl?: string | null;
}

export interface SignedUrlInput {
  objectKey: string;
  expiresInSeconds?: number;
  contentType?: string;
}

export interface SignedUploadResult {
  url: string;
  method: 'PUT' | 'POST';
  objectKey: string;
  expiresAt: Date;
  headers?: Record<string, string>;
}

export interface StorageReadinessResult {
  provider: SchoolOSStorageProvider;
  bucket: string | null;
  writeOk: boolean;
  readOk: boolean;
  deleteOk: boolean;
  signedUrlOk?: boolean;
  signedUrl?: string | null;
}

export interface StorageAdapter {
  putObject(input: PutObjectInput): Promise<StoredObjectResult>;
  getObjectBuffer(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
  createSignedReadUrl(input: SignedUrlInput): Promise<string>;
  createSignedUploadUrl(input: SignedUrlInput): Promise<SignedUploadResult>;
  checkReadiness(): Promise<boolean>;
  testConnection(): Promise<StorageReadinessResult>;
}
```

### Provider Strategy
- **Local:** Use only for local development and simple smoke testing.
  ```env
  STORAGE_PROVIDER=local
  LOCAL_STORAGE_ROOT=storage
  LOCAL_STORAGE_PUBLIC_BASE_URL=/storage
  ```
- **S3-Compatible Providers:** Use one `S3CompatibleStorageAdapter` for AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Wasabi, Backblaze B2 S3 API.
  Generic env variables:
  ```env
  STORAGE_PROVIDER=s3
  OBJECT_STORAGE_BUCKET=schoolos-media
  OBJECT_STORAGE_REGION=ap-south-1
  OBJECT_STORAGE_ENDPOINT=https://s3.ap-south-1.amazonaws.com
  OBJECT_STORAGE_ACCESS_KEY_ID=change-me
  OBJECT_STORAGE_SECRET_ACCESS_KEY=change-me
  OBJECT_STORAGE_PUBLIC_BASE_URL=https://cdn.schoolos.com
  OBJECT_STORAGE_FORCE_PATH_STYLE=false
  ```
  Cloudflare R2 example:
  ```env
  STORAGE_PROVIDER=r2
  OBJECT_STORAGE_BUCKET=schoolos-media
  OBJECT_STORAGE_REGION=auto
  OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
  OBJECT_STORAGE_ACCESS_KEY_ID=change-me
  OBJECT_STORAGE_SECRET_ACCESS_KEY=change-me
  OBJECT_STORAGE_PUBLIC_BASE_URL=https://media.schoolos.com
  OBJECT_STORAGE_FORCE_PATH_STYLE=true
  ```
  MinIO example:
  ```env
  STORAGE_PROVIDER=minio
  OBJECT_STORAGE_BUCKET=schoolos-media
  OBJECT_STORAGE_REGION=us-east-1
  OBJECT_STORAGE_ENDPOINT=http://localhost:9000
  OBJECT_STORAGE_ACCESS_KEY_ID=minioadmin
  OBJECT_STORAGE_SECRET_ACCESS_KEY=minioadmin
  OBJECT_STORAGE_PUBLIC_BASE_URL=http://localhost:9000/schoolos-media
  OBJECT_STORAGE_FORCE_PATH_STYLE=true
  ```
- **GCP Cloud Storage:** Follows same contract behind separate adapter.
  ```env
  STORAGE_PROVIDER=gcp
  GCP_STORAGE_BUCKET=schoolos-media
  GCP_PROJECT_ID=schoolos-prod
  GCP_SERVICE_ACCOUNT_JSON_BASE64=base64-service-account-json
  GCP_STORAGE_PUBLIC_BASE_URL=https://storage.googleapis.com/schoolos-media
  ```

### Object Key Rules
All object keys must be generated by the backend.
Canonical format:
```text
tenants/{tenantId}/{domain}/{ownerId}/{fileId}.{ext}
```
Rules:
- Include `tenantId` in every object key.
- Avoid user-controlled raw file names in object keys.
- Normalize extensions from MIME/signature checks.
- Use File Registry IDs for stable references.
- Never expose raw object keys to unsafe frontend or mobile responses.

---

## 2. Module-Wise Storage Ownership

### Auth / Security / Tenant Isolation
- All file access must use authenticated `tenantId`.
- Cross-tenant file access must fail closed.
- File preview/download routes must return safe permission-denied states.
- Platform support override requires audited reason before tenant file access.

### M0 Platform Core
- Platform settings show provider type, bucket, endpoint readiness, and safe masked status.
- Queue/provider failure dashboard must never expose storage secrets.
- SaaS tenant onboarding checklist should surface object-storage readiness.

### M1 Admissions & Students
- Files: Student photos, student documents, admission documents, guardian documents, student ID card PDF/QR assets, school logo/branding assets.
- Student profile stores file IDs, not provider URLs.
- Document uploads create File Registry records. Photo previews use signed/protected URLs.

### M2 Attendance
- Files: Attendance CSV/PDF exports, monthly register exports.
- Retained exports must have File Registry records.

### M3 Fees & Receipts
- Files: Receipt PDFs, fee collection reports, cashier close/day-end reports, defaulter aging exports, fee-head/period dues exports.
- Receipt reprints should read from File Registry or regenerate with auditable history.
- Cashier close PDFs/CSVs must be tenant-scoped. Finance files must never be public.

### M4 Academics
- Files: Report card PDFs, academic CSV/PDF reports, result publishing snapshots, correction/regeneration history files, school logo assets.
- Report-card PDFs must be tenant-scoped. Result snapshots must be immutable or versioned.

### M5 Activity Feed & Milestones
- Files: Activity media, classroom photos/videos, milestone media, optimized preview variants.
- Activity media is private by default. Parent photo consent must be enforced.

### M6 Homework & Timetable
- Files: Homework attachments, student submission attachments, timetable exports, substitution reports.
- Homework attachment reads must fail closed for unlinked parent/student actors.

### M7 HR & Payroll
- Files: Staff documents, contracts, payslip PDFs, payroll reports/statutory exports.
- Staff PII and payroll files must be permissioned and audited. Payslips must be tenant-scoped and staff self-service safe.

### M8A Library
- Files: Book cover images, library reports, fine-to-fees export artifacts.
- Reports must be tenant-scoped. Book copy archive instead of unsafe deletion when history exists.

### M8B Transport
- Files: Vehicle documents, route/trip reports, GPS history exports.
- GPS latest-location belongs in Redis. Retained reports/exports use File Registry.

### M8C Canteen
- Files: POS receipts, inventory reports, purchase-bill attachments, stock/wastage reports.
- POS receipt PDFs must be tenant-scoped. Purchase-bill attachments must use File Registry.

### M9 Accounting
- Files: Journal exports, trial balance/balance sheet PDFs, bank reconciliation PDFs, saved snapshots, background export artifacts.
- Accounting report snapshots should be immutable/versioned.

### M10 Notices / Communication / Chat
- Files: Notice/chat attachments, notification delivery reports, provider failure exports.
- Attachments must use File Registry access rules. Chat attachment access must fail closed for unlinked actors.

---

## 3. Database Scaling and Hardening Policy

### Core Decision
SchoolOS remains: Monolith-first, PostgreSQL-first, TenantId-scoped, Backend-enforced, Queue-assisted, and Object-storage-backed. Do not add microservices, MongoDB, or Elasticsearch/OpenSearch without explicit approval.

### Near-Term Scalability Order
1. **Index + pagination audit:** Review indexes and enforce pagination when touching an endpoint.
2. **Query optimization:** Eliminate N+1 queries, minimize over-fetching.
3. **BullMQ background jobs:** Move heavy report/PDF/export/provider/media work to BullMQ.
4. **File Registry/object storage:** Store files in object storage, not DB.
5. **Retention and archival:** Expire old GPS pings, temporary exports, and notifications.
6. **Redis caching:** Cache read-heavy settings and platform configs with a TTL.

### PostgreSQL Index Policy
Add indexes only for real query patterns. Common tenant-scoped patterns:
- `tenantId + createdAt / updatedAt / status / studentId / staffId / classId / sectionId / date / fiscalYearId`
- `tenantId + sourceType + sourceId`
- `tenantId + module + status`
- `tenantId + usageKey + period`

Priority tables for index review: `Student`, `AdmissionApplication`, `AttendanceRecord`, `FeeInvoice`, `FeePayment`, `Receipt`, `AccountingJournal`, `AccountingJournalLine`, `AuditLog`, `NotificationDelivery`, `FileAsset`, `ActivityPost`, `Homework`, `TimetableSlot`, `PayrollRun`, `LibraryIssue`, `LibraryFine`, `CanteenWalletTransaction`, `CanteenSale`, `TransportTrip`, `TransportLocationPing`, `TenantSubscription`, `UsageCounter`.

### Pagination Policy
Every growing list endpoint must support pagination. Avoid `findMany` without `take`/`skip` or cursor filters. Small static lookup datasets may remain unpaginated.

### Redis Caching Policy
Redis is for speed, not financial truth. Cache settings, active academic years, and platform plans with a TTL. Never cache payments, receipts, accounting ledgers, or payroll posting states as the source of truth. Cache keys must include `tenantId`. Cache is an optimization; PostgreSQL remains the database source of truth.

### BullMQ Background Job Policy
Slow, retryable, provider-dependent, or batch work must move to BullMQ. Jobs must be tenant-scoped. Jobs that can be retried must be idempotent. Financial jobs must avoid duplicate posting. Queue payloads must not expose secrets.

### Retention and Archival Policy
High-volume operational data needs retention limits. Expire temporary exports, and limit transport GPS ping history. Do not delete accounting, fee, payroll, or legal records casually.

---

## 4. Tenant Isolation and Security Rules

### Tenant Isolation Rule
1. Every query must filter by `tenantId`.
2. A user associated with Tenant A must never access any data belonging to Tenant B.
3. Suspended tenants must be blocked at the gateway, API routes, file registry downloads, background queue processors, and mobile companions.
4. Feature flags must fail closed: if a school hasn't paid for a module, its backend controllers must reject requests even if the UI renders the button.

### Multi-Tenant Security Auditing
- Audit log must record actor, action, tenant, timestamp, and context for all changes to financial records, student records, credentials, settings overrides, and payroll postings.
- Platform operator overrides must require an explicit reason and are stored in the platform settings UI/API audit log.
