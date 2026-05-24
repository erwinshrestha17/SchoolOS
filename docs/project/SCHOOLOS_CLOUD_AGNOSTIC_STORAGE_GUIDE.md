# SchoolOS Cloud-Agnostic Storage Guide

**Status:** Sprint 1 implemented; M0 rollout started; later module migrations remain
**Scope:** Images, media, documents, PDFs, exports, and generated reports
**Applies to:** M0, M1, M3, M4, M5, M6, M7, M8A, M8B, M8C, M9, M10, mobile companion app
**Architecture rule:** Storage providers are infrastructure details. SchoolOS modules must use `FileRegistryService` and `StorageService`, not provider SDKs directly.

---

## 1. Goal

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

## 2. Target Architecture

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

## 3. Storage Adapter Contract

Create or maintain a provider-neutral contract similar to:

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

## 4. Provider Strategy

### Local

Use only for local development and simple smoke testing.

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=storage
LOCAL_STORAGE_PUBLIC_BASE_URL=/storage
```

### S3-compatible providers

Use one `S3CompatibleStorageAdapter` for:

```text
AWS S3
Cloudflare R2
MinIO
DigitalOcean Spaces
Wasabi
Backblaze B2 S3 API
```

Future dependency option:

```bash
pnpm --filter @schoolos/api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Current implementation note:

```text
Sprint 1 introduced the adapter contract, normalized config, and local/S3-compatible adapters using the existing SigV4 implementation. AWS SDK adoption remains optional and should only happen if it reduces maintenance risk without changing module contracts.
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

Recommended dependency only when implementing the adapter:

```bash
pnpm --filter @schoolos/api add @google-cloud/storage
```

---

## 5. Object Key Rules

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

Never use unscoped keys such as:

```text
uploads/photo.jpg
student.pdf
../secret.env
```

Mandatory protections:

- sanitize every object-key segment
- reject path traversal
- never accept raw user-provided `objectKey`
- preserve `tenantId` in every object key
- keep object keys stable across provider migrations

---

## 6. File Registry Source of Truth

File Registry must store provider-neutral metadata.

Recommended fields:

```text
tenantId
provider
bucket
objectKey
originalName
contentType
sizeBytes
checksumSha256
ownerType
ownerId
visibility
createdBy
createdAt
deletedAt
```

Rules:

- Store `fileId` references in module tables, not permanent cloud URLs.
- Keep `publicUrl` optional/backward-compatible only.
- Signed URLs should be generated on demand after permission checks.
- File access must remain tenant-scoped and role/ownership-aware.
- Soft delete metadata before deleting storage objects where business audit requires retention.

---

## 7. Security Rules

SchoolOS files are private by default.

Signed URL expiry recommendations:

```text
Image preview: 5-15 minutes
Document download: 2-5 minutes
PDF reports: 2-5 minutes
Direct upload URL: 5 minutes
```

Never expose:

```text
provider secrets
raw provider errors
bucket credentials
internal stack traces
cross-tenant object keys
unrestricted public URLs for private school data
```

Every sensitive file access must check:

```text
authenticated tenantId
RBAC permission
owner relationship where applicable
guardian/student/staff access rules
file visibility
soft-delete status
```

---

## 8. Direct Upload Flow

For larger files and activity media, prefer direct upload after normal upload is stable.

Flow:

```text
1. Frontend asks backend to initialize upload.
2. Backend creates File Registry draft record.
3. Backend returns short-lived signed upload URL.
4. Frontend uploads directly to provider.
5. Frontend confirms upload completion.
6. Backend verifies metadata and marks file ACTIVE.
```

API shape:

```text
POST /api/v1/files/direct-upload/init
PUT signed-provider-url
POST /api/v1/files/direct-upload/complete
```

Direct upload must remain:

- tenant-scoped
- size-limited
- MIME-type restricted
- extension-validated
- virus/malware-scan-ready later
- auditable
- fail-closed on incomplete uploads

---

## 9. Provider Migration Strategy

To migrate from one provider to another:

```text
1. Freeze provider-specific code behind adapters.
2. Keep objectKey stable.
3. Copy objects from old bucket to new bucket.
4. Update File Registry provider/bucket metadata through a controlled migration job.
5. Switch STORAGE_PROVIDER and env variables.
6. Run storage readiness/testConnection.
7. Run file preview/download smoke tests.
```

For zero-downtime migration, support optional read fallback later:

```env
STORAGE_PROVIDER=s3
STORAGE_READ_FALLBACK_PROVIDER=r2
```

Behavior:

```text
new writes -> primary provider
reads -> primary provider first
if not found -> fallback provider
background job -> copy fallback objects to primary
final step -> remove fallback
```

Do not implement fallback until there is a real migration need.

---

## 10. Module Migration Rule

Every module that handles files must follow this rule:

```text
Module -> FileRegistryService -> StorageService -> StorageAdapter
```

Modules covered:

```text
M1 Student photos and documents
M3 Receipts and fee exports
M4 Report cards and academic exports
M5 Activity media
M6 Homework attachments
M7 Staff documents and payslips
M8A Library documents/reports
M8B Transport driver/vehicle documents and reports
M8C Canteen receipts/reports/item images
M9 Accounting exports and snapshots
M10 Notice/chat attachments
Mobile parent/teacher/driver file previews
```

No module should directly call:

```text
S3Client
GCP Storage client
R2 fetch/signature code
fs.writeFile for production files
provider-specific signed URL generation
```

---

## 11. Implementation Order

```text
[x] Sprint 1: Storage adapter contract and config normalization.
[x] Sprint 1A: Refactor StorageService to delegate to LocalStorageAdapter and S3CompatibleStorageAdapter.
[x] Sprint 1B: Add normalized local/s3/r2/minio/gcp config with backward-compatible R2 aliases.
[x] Sprint 1C: Start M0 readiness rollout by wiring platform storage readiness to normalized config without paid external calls.
[x] M0 parallel hardening note: tenant API key management now stores only hashed secrets and keeps provider/storage secrets out of platform responses.
[ ] Sprint 2: File Registry signed read/download/upload API hardening.
[~] Sprint 3: M1/M5/M10 high-value media/document migration. M1 generated student PDFs now use protected API routes and uploaded File Registry assets; remaining M1 staging/manual checks, M5, and M10 remain.
[ ] Sprint 4: M3/M4/M7/M9 generated PDF/report snapshot migration.
[ ] Sprint 5: M6/M8A/M8B/M8C module-specific files/reports migration.
[ ] Sprint 6: Direct upload flow and image compression queue.
[ ] Sprint 7: Staging provider verification and browser smoke.
[ ] Sprint 8: Optional GCP adapter and migration fallback strategy.
```

Do not start Sprint 8 until normal upload/download is stable with File Registry and signed URLs.

---

## 12. Verification

Run after storage changes:

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
```

Current verification snapshot:

```text
Passed:
- pnpm db:generate
- pnpm db:validate
- pnpm verify:openapi
- pnpm lint
- pnpm typecheck
- pnpm test

Blocked:
- pnpm test:e2e failed on existing non-storage e2e issues: SaaS invoice Decimal string formatting, suspended-tenant plan validation in finance/M9 tests, and missing lifecycle test tenant fixture.
- pnpm build and pnpm verify:production were not run after the failed e2e gate.
```

For staging provider checks, also run:

```text
storage readiness endpoint
provider testConnection endpoint
student photo upload/download manual smoke
activity media upload/preview manual smoke
notice attachment upload/download manual smoke
report-card PDF generation/download manual smoke
receipt PDF generation/download manual smoke
```

---

## 13. Codex Task Template

```text
Read PROJECT_CONTEXT.md, ARCHITECTURE.md, DEVELOPMENT_RULES.md, docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md, docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md, and docs/project/SCHOOLOS_CLOUD_AGNOSTIC_STORAGE_GUIDE.md first.

Task:
Implement the next sprint from the SchoolOS cloud-agnostic storage guide.

Constraints:
- Keep NestJS modular monolith.
- Keep tenantId as the tenant/school boundary.
- Do not introduce microservices.
- Do not rewrite unrelated modules.
- Modules must use FileRegistryService/StorageService only.
- No provider SDK imports inside feature modules.
- Files are private by default.
- Signed URLs must be short-lived.
- Add validation, tests, and safe errors.
- Run verification commands.

Return:
- Summary
- Files changed
- Commands run
- Verification results
- Remaining gaps
```
