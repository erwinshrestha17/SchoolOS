# SchoolOS Storage and File Registry Guide

**Last updated:** 2026-06-02

**Status:** Active storage and file/media source of truth.

This replaces:

```text
docs/project/SCHOOLOS_CLOUD_AGNOSTIC_STORAGE_GUIDE.md
docs/project/SCHOOLOS_MODULE_WISE_STORAGE_ROLLOUT.md
```

Do not recreate those separate docs unless the project grows enough to justify splitting them again.

---

## 1. Global Rule

Every module that creates, uploads, previews, downloads, exports, or deletes a file must follow this path:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

Never do this inside a feature module:

```text
AWS SDK import
GCP SDK import
R2 manual signing
MinIO direct client
fs.writeFile for production files
hardcoded provider URL
permanent public URL as source of truth
```

Storage providers are infrastructure details. SchoolOS modules must use `FileRegistryService` and `StorageService`, not provider SDKs directly.

---

## 2. Goal

SchoolOS must support changing storage providers without rewriting module code.

Supported target providers:

```text
local disk
Cloudflare R2
AWS S3
MinIO
GCP Cloud Storage
other S3-compatible providers later
```

Changing provider should normally require only:

```text
1. Update environment variables.
2. Verify provider readiness.
3. Run migration/copy jobs if existing objects must move.
4. Keep object keys and File Registry metadata stable.
```

Modules such as Students, Activity Feed, Notices, Homework, Payroll, Accounting, Library, Canteen, Transport, and mobile must not know whether the backing platform is R2, S3, GCP, MinIO, or local disk.

---

## 3. Target Architecture

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

Rules:

- `FileRegistryService` owns file metadata, permissions, ownership, auditability, and lifecycle.
- `StorageService` owns provider selection and stable storage methods.
- `StorageAdapter` owns provider-specific implementation.
- Feature modules must never import AWS, R2, GCP, MinIO, or filesystem clients directly.
- Backend APIs must return file IDs or short-lived signed URLs, not permanent provider URLs as the source of truth.

---

## 4. Storage Adapter Contract

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

---

## 5. Provider Strategy

### Local

Use only for local development and simple smoke testing.

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=storage
LOCAL_STORAGE_PUBLIC_BASE_URL=/storage
```

### S3-Compatible Providers

Use one `S3CompatibleStorageAdapter` for:

```text
AWS S3
Cloudflare R2
MinIO
DigitalOcean Spaces
Wasabi
Backblaze B2 S3 API
```

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

Backward-compatible R2 aliases may remain during migration:

```env
R2_BUCKET=
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_REGION=
R2_PUBLIC_BASE_URL=
```

### GCP Cloud Storage

GCP can be supported behind a separate adapter. It must still follow the same `StorageAdapter` contract.

```env
STORAGE_PROVIDER=gcp
GCP_STORAGE_BUCKET=schoolos-media
GCP_PROJECT_ID=schoolos-prod
GCP_SERVICE_ACCOUNT_JSON_BASE64=base64-service-account-json
GCP_STORAGE_PUBLIC_BASE_URL=https://storage.googleapis.com/schoolos-media
```

---

## 6. Object Key Rules

All object keys must be generated by the backend.

Canonical format:

```text
tenants/{tenantId}/{domain}/{ownerId}/{fileId}.{ext}
```

Examples:

```text
tenants/tnt_123/students/std_456/photos/file_abc.jpg
tenants/tnt_123/activity/post_789/media/file_def.webp
tenants/tnt_123/reports/fees/file_xyz.pdf
tenants/tnt_123/notices/notice_111/attachments/file_222.pdf
tenants/tnt_123/homework/hw_333/attachments/file_444.pdf
tenants/tnt_123/payroll/run_555/payslips/file_666.pdf
```

Rules:

- Include `tenantId` in every object key.
- Avoid user-controlled raw file names in object keys.
- Normalize extensions from MIME/signature checks.
- Use File Registry IDs for stable references.
- Never expose raw object keys to unsafe frontend or mobile responses.

---

## 7. Phase Gate Storage Tasks

Current completed storage foundation:

```text
[x] Refactor StorageService into adapter pattern.
[x] Normalize storage config for local, s3, r2, minio, and optional gcp.
[x] Preserve existing R2 env aliases during migration.
[x] Ensure object keys are tenant-scoped.
[x] Ensure File Registry remains the source of truth.
[x] Add tests for local and S3-compatible adapter behavior.
```

Exit requirement:

```text
SchoolOS can switch between local, R2, AWS S3, and MinIO through env variables without module code changes.
```

---

## 8. Module-Wise Ownership

### Auth / Security / Tenant Isolation

Storage impact:

- All file access must use authenticated `tenantId`.
- Cross-tenant file access must fail closed.
- File preview/download routes must return safe permission-denied states.
- Platform support override requires reason before tenant file access.

Tests:

```text
user from tenant A cannot access tenant B file
platform support override requires reason before tenant file access
expired session cannot access signed URL generation endpoint
permission-denied response is safe and human-readable
```

### M0 Platform Core

Storage impact:

- Provider readiness checks selected storage provider config.
- Platform settings show provider type, bucket, endpoint readiness, and safe masked status.
- Queue/provider failure dashboard must never expose storage secrets.
- SaaS tenant onboarding checklist should surface object-storage readiness.

Manual smoke:

```text
local provider testConnection
R2 provider testConnection in staging
MinIO testConnection locally
failed provider config shows safe error
```

### M1 Admissions & Students

Files owned:

```text
student photos
student documents
admission documents
guardian documents
student ID card PDF/QR assets
school logo/branding assets used in student/profile PDFs
```

Rules:

- Student profile stores file IDs, not provider URLs.
- Document uploads create File Registry records.
- Photo previews use signed/protected URLs.
- Document audit trail includes upload/download/delete lifecycle.
- Generated student PDFs must not use raw public cloud URLs.

### M2 Attendance

Files owned:

```text
attendance CSV exports
attendance PDF reports
monthly register exports
future correction request attachments if approved
```

Rules:

- Retained exports should go through report/File Registry pipeline.
- Temporary exports may stream, but retained reports must have File Registry records.
- Parent attendance summary must not expose admin-only files.

### M3 Fees & Receipts

Files owned:

```text
receipt PDFs
fee collection reports
cashier close/day-end reports
defaulter aging exports
fee-head/period dues exports
payment reversal/correction evidence attachments if approved
```

Rules:

- Receipt reprints should read from File Registry or regenerate with auditable history.
- Cashier close PDFs/CSVs should be tenant-scoped.
- Finance files must never be public.
- Dangerous finance exports must be audited.

### M4 Academics

Files owned:

```text
report card PDFs
academic CSV/PDF reports
result publishing snapshots
correction/regeneration history files
school logo assets embedded in PDFs
```

Rules:

- Report-card PDFs are tenant-scoped.
- Published result snapshots must be immutable or versioned.
- Logo/assets must be loaded through storage/File Registry boundaries.

### M5 Activity Feed & Milestones

Files owned:

```text
activity media
classroom photos/videos
milestone media
optimized preview variants
```

Rules:

- Activity media is private by default.
- Parent photo consent must be enforced before media previews.
- Responses must not expose raw storage keys, public URLs, or unsafe File Registry IDs.

### M6 Homework & Timetable

Files owned:

```text
homework attachments
student submission attachments
timetable exports
substitution reports
```

Rules:

- Homework attachment reads must fail closed for unlinked parent/student actors.
- Student attachment downloads must use protected/signed access helpers.

### M7 HR & Payroll

Files owned:

```text
staff documents
contracts
payslip PDFs
payroll reports/statutory exports
leave/HR evidence attachments if approved
```

Rules:

- Staff PII and payroll files must be permissioned and audited.
- Payslip PDFs must be tenant-scoped and staff/self-service safe.

### M8A Library

Files owned:

```text
book cover images if supported
library reports
fine-to-fees export artifacts
borrower/import files if approved
```

Rules:

- Library reports must be tenant-scoped.
- QR/barcode flows must not leak borrower data across tenants.

### M8B Transport

Files owned:

```text
vehicle documents
route/trip reports
GPS history exports if approved
driver documents if owned by transport later
```

Rules:

- GPS latest-location belongs in Redis.
- Retained reports/exports use File Registry.
- Location data is tenant/trip scoped and retention-limited.

### M8C Canteen

Files owned:

```text
POS receipts
inventory reports
purchase-bill attachments
supplier documents if approved
stock/wastage reports
```

Rules:

- POS receipt PDFs must be tenant-scoped.
- Purchase-bill attachments must use File Registry.
- Stock/accounting exports must not expose provider URLs.

### M9 Accounting

Files owned:

```text
journal exports
trial balance PDFs
balance sheet PDFs
bank reconciliation PDFs
saved report snapshots
queued background export artifacts
```

Rules:

- Accounting report snapshots should be immutable/versioned.
- Reports must come from backend ledger/report services.
- Downloads must be permissioned and audited.

### M10 Notices / Communication / Chat

Files owned:

```text
notice attachments
chat attachments
notification delivery reports
provider failure exports
```

Rules:

- Attachments must use File Registry access rules.
- Guardian-owned chat attachment access must fail closed.
- Provider failures must not expose secrets or PII-heavy payloads.

---

## 9. Verification

Run relevant checks after storage/File Registry changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Provider verification that touches real object storage must be configured, safe, and non-paid by default.
