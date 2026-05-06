# SchoolOS Platform Core Memory

This file extends the main SchoolOS project memory with reusable SaaS-platform capabilities that should be added to SchoolOS over time. It is intentionally documentation-first, but the approved near-term execution plan below can be implemented during Phase 1B when it directly strengthens current operational depth.

Read this together with:

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`
- `docs/project/SCHOOLOS_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`

## Current Approved Direction

SchoolOS is currently in the Phase 1B Completion Sprint. The agreed implementation direction is:

```text
1. Finish the next Phase 1B Student Management slice first:
   /dashboard/students/[studentId]

2. Then start M0 Platform Core foundations in this order:
   a. Platform Control Plane foundation when needed for school/tenant management
   b. Tenant Settings foundation
   c. Generic File Registry
   d. Global API Response Envelope with PDF/file exceptions
   e. Generic Reports Foundation
   f. Safe Activity Logs
   g. Usage Limits and Plan Rules

3. Then implement medium-priority platform integrations only when needed:
   a. API Key Management
   b. Webhook System
   c. SaaS Subscription and Billing
```

Rationale:

- Student Management depth is the immediate Phase 1B priority and should not be delayed by platform overbuilding.
- Platform Control Plane foundation is needed when SchoolOS company owner workflows require managing schools/tenants, plans, limits, support access, and platform audit.
- Tenant Settings should come early because branding, receipt format, attendance lock time, fiscal/academic behavior, fee reminders, and future chat hours need centralized tenant configuration.
- The detailed boundary between school-owned settings and platform-owned SaaS settings is documented in `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`.
- Generic File Registry should come before more document/photo/media work because Phase 1B needs student photos, student documents, activity media previews, receipt PDFs, ID cards, and certificates.
- Global API Response Envelope is valuable but risky, so it must be rolled out carefully with contract tests and raw binary/PDF/file response exceptions.
- Reports Foundation should come before building many separate exports/reports for students, attendance, fees, defaulters, and cashier close.
- Safe Activity Logs should follow once domain events/audit projections are stable enough to generate safe operational history.
- Usage Limits and Plan Rules should come before serious multi-school paid rollout.
- API Keys, Webhooks, and SaaS Billing are important but should not block Phase 1B operational depth.

## Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith. These are access, routing, and responsibility boundaries, not microservice boundaries at this stage.

### Layer 1: Platform Control Plane

For the SchoolOS company owner and internal platform team.

Purpose:

- Manage all schools/tenants.
- Manage plans and subscriptions.
- Manage SaaS billing and renewal status.
- Manage usage limits and plan enforcement.
- Manage support access / tenant override.
- View platform audit logs.
- Monitor global operational health, failed jobs, delivery failures, and provider issues.

Typical users:

- `PLATFORM_SUPER_ADMIN`
- `PLATFORM_SUPPORT`
- `PLATFORM_BILLING_ADMIN`

Recommended route/API namespace:

```text
Frontend: /platform/*
Backend:  /platform/*
```

Core rule: platform access must be explicit, permission-guarded, and audited. Platform users are SchoolOS company users, not school staff.

### Layer 2: Tenant Configuration Plane

For each school principal/admin to configure their own school.

Purpose:

- Manage school logo and branding.
- Manage academic year and fiscal settings.
- Manage receipt format and numbering preferences.
- Manage attendance lock time.
- Manage fee due/reminder rules.
- Manage notification/SMS preferences.
- Manage school-level feature toggles.
- Manage future parent-teacher chat availability hours.

Typical users:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`
- Limited super-admin support access with audit trail.

Recommended route/API namespace:

```text
Frontend: /dashboard/settings/*
Backend:  /tenant-settings/* or /settings/*
```

Core rule: tenant configuration is tenant-owned data and must always be scoped by `tenantId`.

For the detailed school settings vs platform settings split, use `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md` as the source of truth.

### Layer 3: School Operations Plane

For day-to-day school staff operations.

Purpose:

- Manage students and admissions.
- Mark attendance.
- Collect fees and print receipts.
- Publish notices.
- Manage activity feed and milestones.
- View reports and exports.
- Later: academics, timetable, HR/payroll, library, transport, canteen, and accounting.

Typical users:

- `TENANT_PRINCIPAL`
- `TENANT_ADMIN`
- `TENANT_ACCOUNTANT`
- `TENANT_TEACHER`
- `TENANT_STAFF`
- `TENANT_PARENT`
- `TENANT_STUDENT`

Recommended route/API namespace:

```text
Frontend: /dashboard/*
Backend:  module-specific tenant APIs such as /students, /attendance, /finance, /notices
```

Core rule: school operations must consume real tenant-scoped APIs. Frontend visibility is not security; backend guards and `tenantId` filters enforce isolation.

## Plane Separation Rules

- Platform Control Plane manages SaaS/customer administration.
- Tenant Configuration Plane manages a school's own settings.
- School Operations Plane manages day-to-day school workflows.
- Use `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md` for the complete school-settings vs platform-settings boundary.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Do not allow school users to access `/platform/*` routes.
- Do not allow platform support to enter a tenant silently; support/tenant override must require an explicit reason and audit log.
- Keep `tenantId` as the tenant/school boundary.
- Keep all three planes in the NestJS modular monolith for now.
- Do not introduce microservices only to separate these planes.

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
- All platform actions affecting tenants, plans, billing, support access, or limits must be audited.

## M0 Platform Core Additions

### 1. Platform Control Plane Foundation

Purpose: provide the SchoolOS company owner/super-admin dashboard for managing all schools/customers.

Implementation timing: after the next Student Management detail slice, or earlier only if tenant/school management is blocking pilot operations.

Scope:

- Platform-only route namespace: `/platform/*`.
- Platform-only backend namespace: `/platform/*`.
- Tenant/school list.
- Tenant/school detail.
- Create tenant/school later if not already covered by tenant registration.
- Activate/suspend/cancel tenant status.
- View tenant usage summary.
- View assigned plan/subscription summary.
- View support/tenant override history.
- Platform audit log for tenant-impacting actions.

Implementation notes:

- Platform users must be separate from tenant users or clearly separated by role/permission.
- Start with `PLATFORM_SUPER_ADMIN` only.
- School users must never access platform routes.
- Support/tenant override must require explicit reason and be audited.
- Do not mix SaaS billing with school fee collection.

### 2. Tenant Settings Module

Purpose: provide centralized school-level configuration instead of scattering settings across modules.

Implementation timing: implement after the Platform Control Plane foundation when needed, during Phase 1B.

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

For the full school-level settings categories, route structure, and non-negotiable boundary against platform settings, read `docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md`.

Implementation notes:

- Store settings as tenant-scoped records.
- Validate setting keys and value types server-side.
- Audit every setting change.
- Expose read APIs to frontend modules and guarded write APIs to principal/super-admin roles.
- Start with a backend foundation and minimal frontend API helper; avoid a large settings UI until the API is stable.

### 3. Generic File Registry

Purpose: create a reusable metadata registry for files across modules while actual storage remains private object storage.

Implementation timing: implement after Tenant Settings, before deeper student documents/photos and activity media work.

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
- Keep storage implementation behind a service boundary so Cloudflare R2, S3, or MinIO can be swapped/configured later.

### 4. Global API Response Envelope

Purpose: make backend responses consistent for web, future mobile apps, and external integrations.

Implementation timing: implement after File Registry, carefully and incrementally.

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
- Keep PDF/file/CSV/stream responses exempt where raw binary responses are required.
- Update frontend API clients gradually instead of rewriting all consumers in one pass.

### 5. Generic Reports Foundation

Purpose: provide a reusable reporting framework so every module does not reinvent filters, exports, permissions, and audit behavior.

Implementation timing: implement before building multiple Phase 1B reports/exports.

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

Phase 1B reports that should plug into it first:

- Class roster CSV/PDF export.
- Student fee ledger export.
- Attendance monthly register.
- Attendance CSV/PDF export.
- Fee collection reports.
- Defaulter aging reports.
- Cashier close/day-end reports.

Later modules that should plug into it:

- Payroll reports.
- Library reports.
- Transport reports.
- Canteen reports.
- Accounting reports.

### 6. Safe Activity Logs Module

Purpose: separate safe user-facing operational history from compliance audit logs and parent-facing activity feed.

Implementation timing: implement after core domain events/audit projections are stable.

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

### 7. Usage Limits and Plan Rules

Purpose: support real SaaS pricing, plan enforcement, and Nepal-market packaging.

Implementation timing: implement late Phase 1B before serious multi-school paid rollout.

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
- Start with read-only plan/limit reporting before enforcing hard blocks on pilot schools.

### 8. API Key Management

Purpose: allow secure programmatic access for future mobile clients, partners, gateways, and integrations.

Implementation timing: late Phase 1B or early Phase 2, only when an external integration requires it.

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

### 9. Webhook System

Purpose: provide outbound event delivery to external systems and future apps.

Implementation timing: after API Key Management, or only when payment/SMS/external integrations require webhook delivery.

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

### 10. SaaS Subscription and Billing Module

Purpose: separate SchoolOS company billing from school fee collection.

Implementation timing: after Usage Limits and Plan Rules, before broad paid SaaS rollout. For early pilots, manual subscription tracking is acceptable.

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

## Approved Priority Order

### Immediate product slice before M0

1. Full student detail route: `/dashboard/students/[studentId]`.

### Phase 1B M0 Platform Core sequence

1. Platform Control Plane foundation where needed for school/tenant management.
2. Tenant Settings Module.
3. Generic File Registry.
4. Global API Response Envelope with PDF/file/CSV exceptions.
5. Generic Reports Foundation.
6. Safe Activity Logs Module.
7. Usage Limits and Plan Rules.

### Late Phase 1B / Early Phase 2 platform integrations

8. API Key Management.
9. Webhook System.

### Before broad commercial SaaS rollout

10. SaaS Subscription and Billing Module.

### Later

11. Angular admin migration.
12. Advanced external developer portal.
13. Marketplace/integration system.

## Recommended Near-Term Direction

Do not copy the whole generic SaaS template into SchoolOS. Add only reusable platform modules that directly strengthen SchoolOS production readiness.

Near-term execution should be:

```text
Student detail page
→ Platform Control Plane foundation when needed
→ Tenant Settings foundation
→ Generic File Registry
→ Student documents/photos + Activity signed media using File Registry
→ Global API response envelope
→ Reports foundation
→ Phase 1B reports/exports
→ Safe Activity Logs
→ Usage Limits and Plan Rules
```

This sequence supports Phase 1B without prematurely starting Phase 2.