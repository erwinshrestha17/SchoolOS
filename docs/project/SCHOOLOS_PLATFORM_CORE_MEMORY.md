# SchoolOS Platform Core Memory

This file extends the main SchoolOS project memory with reusable SaaS-platform capabilities that should be added to SchoolOS over time. It is intentionally documentation-only for now.

Read this together with:

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`
- `docs/project/SCHOOLOS_PROJECT_MEMORY.md`

## Why this file exists

SchoolOS already has strong school-domain modules: admissions, students, guardians, attendance, fees, receipt PDFs, student documents, activity feed, notices, consent, finance ledger foundation, cashier close, academics, timetable, payroll, messaging, library, transport, and canteen planning.

The missing area is reusable SaaS-platform depth. These capabilities should be added carefully into the existing NestJS modular monolith, not copied blindly from a generic template and not implemented as microservices at this stage.

## Architecture Position

Add these features under `M0 Platform Core` or equivalent platform modules.

Rules:

- Keep the NestJS modular monolith.
- Keep PostgreSQL + Prisma as the system of record.
- Keep Redis/BullMQ for cache, queues, rate limits, delivery, and background exports.
- Keep tenant isolation through `tenantId`.
- Do not rename `tenantId` to `schoolId`.
- Do not migrate the dashboard to Angular yet.
- Do not start Phase 2 domain modules just because these platform items are documented.
- Implement platform additions in small, focused tasks.
- All tenant-owned queries must be tenant-scoped.
- All business-critical writes must be audited.

## M0 Platform Core Additions

### 1. Tenant Settings Module

Purpose: provide centralized school-level configuration instead of scattering settings across modules.

Scope:

- School logo and branding colors.
- Fiscal year settings.
- Academic year behavior.
- Receipt format and numbering preferences.
- Attendance lock time.
- Grading scheme configuration where legally allowed; Nepal MoEST grading rules remain server-controlled where required.
- SMS sender/provider preference.
- Chat availability hours.
- Fee due rules and reminder timing.
- Nepali/English naming preferences.
- Date format, timezone, and currency.
- Feature toggles by tenant and plan.

Implementation notes:

- Store settings as tenant-scoped records.
- Validate setting keys and value types server-side.
- Audit every setting change.
- Expose read APIs to frontend modules and guarded write APIs to principal/super-admin roles.

### 2. Global API Response Envelope

Purpose: make backend responses consistent for web, future mobile apps, and external integrations.

Recommended shape:

```ts
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
  meta?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
};
```

Scope:

- Global response interceptor for successful API responses.
- Global exception filter alignment for errors.
- Pagination metadata convention.
- Request/correlation ID support.
- OpenAPI documentation compatibility.

Rules:

- Do not break existing frontend flows in one large rewrite.
- Roll out carefully with contract tests.
- Keep PDF/file responses exempt where raw binary responses are required.

### 3. Generic Reports Foundation

Purpose: provide a reusable reporting framework so every module does not reinvent filters, exports, permissions, and audit behavior.

Scope:

- Report registry.
- Report permissions.
- Tenant-scoped report queries.
- Date filters and common filter DTOs.
- CSV export.
- PDF export.
- Background export jobs for heavy reports.
- Audit log for report viewing/exporting.
- Saved report definitions later.

Modules that should plug into it:

- Student reports.
- Attendance reports.
- Fee collection reports.
- Defaulter aging reports.
- Cashier close/day-end reports.
- Payroll reports.
- Library reports.
- Transport reports.
- Canteen reports.
- Accounting reports.

### 4. Safe Activity Logs Module

Purpose: separate safe user-facing operational history from compliance audit logs and parent-facing activity feed.

Definitions:

```text
Audit Logs = internal compliance/security trail with sensitive old/new values.
Activity Feed = parent/student learning and classroom social feed.
Activity Logs = safe operational summaries for admins/users.
```

Example activity logs:

- Invoice `INV-001` was paid.
- Student photo was updated.
- Attendance was submitted.
- Teacher changed marks.
- Receipt was generated.
- Fee refund was created.
- Notice was published.
- Cashier close was completed.

Rules:

- Activity logs must not expose sensitive old/new values.
- Activity logs must be tenant-scoped.
- Activity logs should be derived from domain events or audit projections where possible.
- Activity logs should support filtering by actor, module, entity, and date.

### 5. Usage Limits and Plan Rules

Purpose: support real SaaS pricing, plan enforcement, and Nepal-market packaging.

Scope:

- Plan model: Starter, Standard, Premium, Enterprise or equivalent.
- Feature entitlements by plan.
- Usage limits by tenant.
- Student count limit.
- Staff user limit.
- Parent user limit.
- Branch/campus limit.
- SMS quota.
- Storage quota.
- Transport GPS enablement.
- Canteen enablement.
- Accounting add-on enablement.
- AI feature enablement later.

Rules:

- Enforcement must happen server-side.
- UI may hide locked features but API must still enforce entitlements.
- Usage-limit checks must be tenant-scoped and audited when blocking a critical action.

### 6. API Key Management

Purpose: allow secure programmatic access for future mobile clients, partners, gateways, and integrations.

Use cases:

- Mobile app API access where appropriate.
- eSewa/Khalti callbacks.
- SMS provider callbacks.
- Partner API access.
- iEMIS/export integrations.
- External admissions form submission.
- School website integrations.

Scope:

- Hashed API keys only.
- Key prefix display only.
- Tenant-scoped key ownership.
- Scopes/permissions.
- Expiry.
- Revocation.
- Last-used timestamp.
- Usage logs.
- Rate limiting.

Rules:

- Never store raw API keys after creation.
- API keys must not bypass tenant isolation.
- API keys must have narrower scopes than human super-admin access.

### 7. Webhook System

Purpose: provide outbound event delivery to external systems and future apps.

Events that may emit webhooks later:

- Payment received.
- Invoice paid.
- Student admitted.
- Attendance submitted.
- Transport trip started.
- Bus reached stop.
- Notice delivered.
- Payroll approved.
- Report card published.
- Canteen wallet topped up.

Scope:

- Webhook endpoints per tenant.
- Event subscriptions.
- Signed webhook payloads.
- Delivery attempts.
- Retry with backoff.
- Dead-letter state.
- Delivery logs.
- Manual resend.

Rules:

- Use BullMQ for delivery jobs.
- Sign payloads with tenant-specific webhook secrets.
- Never include sensitive PII unless the event scope explicitly allows it.

### 8. Generic File Registry

Purpose: create a reusable metadata registry for files across modules while actual storage remains private object storage.

Scope:

- File ID.
- Tenant ID.
- Uploaded-by user ID.
- Original filename.
- Object storage key.
- MIME type.
- Size.
- Hash/checksum later.
- Module/entity linkage.
- Status.
- Metadata.
- Soft delete timestamp.

Applies to:

- Student photos.
- Guardian documents.
- Staff documents.
- Receipts.
- ID cards.
- Activity photos.
- Homework attachments.
- Notice attachments.
- Library files.
- Transport documents.
- Canteen/vendor documents.

Rules:

- Files must not be public by default.
- Serve private files through signed URLs.
- Apply strict tenant ownership checks before generating signed URLs.
- Audit sensitive document access.

### 9. SaaS Subscription and Billing Module

Purpose: separate SchoolOS company billing from school fee collection.

Important distinction:

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using the platform.
```

Scope:

- School subscription.
- Plan assignment.
- Trial period.
- Renewal date.
- Monthly/yearly billing.
- Payment status.
- Tenant suspension when unpaid.
- School-facing SaaS invoice.
- Module add-ons.
- SMS/storage/AI add-on billing later.

Rules:

- Keep SaaS billing separate from student fee management.
- Super-admin/platform owner manages SaaS billing.
- Tenant suspension must be careful and auditable.
- Schools should retain read-only access to critical records when appropriate, even if write access is suspended.

## Priority Order

High priority after or alongside Phase 1B operational depth:

1. Tenant Settings Module.
2. Global API Response Envelope.
3. Generic Reports Foundation.
4. Safe Activity Logs Module.
5. Usage Limits and Plan Rules.

Medium priority:

6. API Key Management.
7. Webhook System.
8. Generic File Registry.
9. SaaS Subscription and Billing Module.

Later:

10. Angular admin migration.
11. Advanced external developer portal.
12. Marketplace/integration system.

## Recommended Near-Term Direction

Do not copy the whole generic SaaS template into SchoolOS. Add only reusable platform modules that directly strengthen SchoolOS production readiness.

Immediate next platform-oriented implementation sequence:

1. Tenant Settings foundation.
2. Global API response envelope with safe binary/PDF exceptions.
3. Reports foundation for Phase 1B reports.
4. Safe Activity Logs projection.
5. Usage limits and plan rules.

This sequence supports Phase 1B without prematurely starting Phase 2.
