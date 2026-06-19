# SchoolOS Platform Operations

**Last updated:** 2026-06-19  
**Status:** Consolidated source of truth for platform control plane, tenant configuration boundaries, settings, provider operations, notification-provider governance, and real-time operations readiness.  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ.

---

## 1. Platform Operations and Settings Governance

### Purpose
SchoolOS has separate platform and school settings surfaces. This separation is required for tenant isolation, SaaS billing correctness, school finance correctness, security, auditability, notification-provider correctness, and maintainability.

Core rule:
- If the setting changes one school's daily operation, it belongs in School Settings (`/dashboard/settings/*`).
- If the setting changes SaaS ownership, billing, infrastructure, provider credentials, tenant access, feature flags, or global defaults, it belongs in Platform Settings (`/platform/settings/*`).

### Three-Plane SaaS Architecture
- **Platform Control Plane:** Gated for SchoolOS owner/operator. Access via `/platform/*`. Handles school/tenant setup, SaaS billing, provider setups, global audits, platform notification-provider health, and queue operations.
- **Tenant Configuration Plane:** Gated for School Principal or Admin. Access via `/dashboard/settings/*`. Handles school branding, academic calendars, localized fee heads, localized role mappings, school notification preferences, and template overrides.
- **School Operations Plane:** Gated for daily school workflows (staff, parents, students). Access via `/dashboard/*`. Handles core modules like admissions, attendance, homework, exams, canteen, library, notifications, and communication.

Rules:
- School users must not access `/platform/*` routes.
- Platform support/tenant override must require an explicit reason and audit log.
- Keep all planes inside the modular monolith for now.

### Critical Billing Boundary
- **SchoolOS Finance/M3/M9:** School collects fees/money from students/parents.
- **SaaS Billing:** SchoolOS company charges schools for using the platform.

Do not mix school fee collection with platform SaaS billing.
- Student receipt, fee invoice, cashier close, school ledger -> M3/M9 school finance.
- School subscription, plan, SMS quota, AI credits, module entitlement -> M0 platform/SaaS billing.

M0 SaaS billing records must not post directly into school tenant fee ledgers.

### Separation Matrix

| Area | School Settings | Platform Settings |
|---|---|---|
| School name/logo | Yes | Can view/edit during onboarding/support |
| Fee plans | Yes | Defaults only |
| Student fee collection | Yes | No |
| Payroll rules | Yes | No |
| Accounting fiscal year | Yes | No |
| User roles inside school | Yes | Platform support can assist with audit |
| Subscription plan | No | Yes |
| Enable/disable modules | Limited visibility | Yes |
| SMS/provider API key | No | Yes |
| Email/push provider credential | No | Yes |
| School SMS/email/push preference | Yes | Quota/policy/provider control |
| Notification templates | Customize own copy where allowed | Define global defaults and protected emergency templates |
| Notification delivery logs | Own school only | Platform-wide provider diagnostics where authorized |
| Database/Redis health | No | Yes |
| Tenant creation/suspension | No | Yes |
| Super-admin tenant override | No | Yes |
| Audit logs | Own school only | Platform-wide |
| Default templates | Customize own copy | Define global defaults |
| SaaS invoice to school | No/read-only billing page later | Yes |
| Receipt paid by parent/student | Yes | No |

---

## 2. Platform Core Implementation Status & Priorities

### Current M0 Platform Core Status
M0 Platform Core Foundation is completed. Current focus is staging verification, browser coverage, entitlement enforcement, provider readiness, queue/File Registry hardening, notification-provider diagnostics, and pilot reliability.
M0 remains inside the existing NestJS modular monolith. It is not a separate microservice and should not be split unless scale or compliance requires it.
For current pilot backend closure, tenant onboarding is modeled as a computed readiness checklist with audited platform overrides. A separate onboarding state machine is deferred unless product requirements add approval, rollback, or multi-status transition needs.

Implemented M0 foundation areas:
- Platform tenant list/detail/dashboard/status flows
- Reason-required tenant suspend/activate actions
- Platform tenant subscription plan-change workflow with audit reason
- Reasoned, time-bound support override entry from tenant detail
- Tenant SaaS invoice create/payment/cancel actions and billing profile edit workflow
- Tenant onboarding checklist detail and audited override workflow
- Plan, feature, subscription, override, and usage-counter foundations
- Provider config masking and secret-safe response shape
- Provider readiness detail API with dry-run validation
- Queue health plus audited retry/discard operator workflows
- Failed-job detail inspection with sanitized payloads and retry audit history
- Failed-job grouping diagnostics by queue, job name, bounded failure reason, tenant hints, and retry-safety category
- File upload validation and dangerous extension blocking
- Private/protected file URL response shape
- Report export history and audited export persistence
- Platform health summary for DB, Redis, queues, and storage readiness

### Platform Core Priority Order
1. Run Docker-backed smoke with Postgres, Redis, API, and web running.
2. Add platform/school route denial browser tests.
3. Add SaaS billing lifecycle tests.
4. Add entitlement enforcement tests against real school APIs.
5. Deepen BullMQ failed-job inspection for deployed queue topology.
6. Expand async report/export generation module by module.
7. Expand demo Nepal pilot tenant seed data.
8. Polish platform audit/usage visibility.
9. Add notification-provider health/callback/delivery diagnostics where not already covered by M10.
10. Add API-key management UI only when integrations require it.
11. Add webhook system only when external integrations require it.

---

## 3. Real-Time Transport Operations (GPS & Ingestion)

This section records the backend readiness boundary before any production live transport map, parent tracking UI, or driver app work begins.

### Current Safe Scope
- Admin/trip/location backend is implemented inside the NestJS monolith.
- GPS ingestion validates latitude/longitude, accepts only active trips, and enforces driver assignment unless the actor has transport admin privileges.
- Redis stores the latest trip location with a six-hour TTL.
- PostgreSQL remains the durable source of truth and persists location pings only when the last persisted ping is at least 30 seconds old.
- Redis pub/sub publishes tenant/trip-scoped location updates for existing SSE consumers.
- A Redis pressure key rejects same-user trip pings faster than once per second.
- Location cleanup is tenant-scoped and requires an admin role; retention must be between 1 and 365 days.

### Not Yet Approved
- Production live map UI.
- Parent tracking UI.
- Driver app.
- ETA, geofence, overspeed, or route-deviation automation.
- Transport billing/accounting integration.

### Required Before Live Map Expansion
1. Run Docker-backed staging with Postgres, Redis, API, and web.
2. Load-test GPS ingestion with realistic driver device cadence.
3. Confirm Redis pub/sub behavior with multiple subscribers and reconnects.
4. Decide whether SSE is enough for admin-only live status or whether WebSocket fanout is needed.
5. Add operational metrics for rejected pressure pings, Redis failures, stale cache, and persisted ping counts.
6. Add browser smoke for stale/latest location states before adding map rendering.
7. Keep parent/driver/mobile routes deferred until ownership and device-auth contracts are approved.

### Recommended Next Implementation
Keep the next pass admin-only:
- Add stale-location metrics and admin labels.
- Add a report for location ingestion acceptance vs rejection counts.
- Add Redis outage fallback behavior for latest-location reads.
- Run Playwright only against seeded staging, not invented production data.

---

## 4. Notification Delivery and Provider Operations

The cross-module notification layer is governed by `SCHOOLOS_NOTIFICATION_ARCHITECTURE.md`. Platform operations owns provider readiness, secret masking, callback verification diagnostics, delivery queue visibility, provider-disabled behavior, and platform-wide failure visibility. School operations owns school-level notification preferences, template overrides where allowed, and recipient-facing notification-center workflows.

### Platform-owned notification controls

- SMS/email/push provider credential setup and masking.
- Provider readiness checks and callback verification status.
- Disabled/mock/dev-log provider mode labels.
- Platform-wide failed-delivery diagnostics where permission allows.
- Queue health and retry/discard operations for notification jobs.
- Provider quota/limit visibility where exposed by provider integrations.
- Protected default templates for emergency/security/high-impact message families.

### Tenant-owned notification controls

- School notification preferences by category/channel where policy allows.
- Tenant-specific template wording where override is allowed.
- Quiet-hours policy for non-critical notifications.
- Own-school delivery logs and retry requests where permission allows.
- Notification center read/archive state for users.

### Required boundaries

1. Feature modules emit notification events; they do not call provider adapters directly.
2. Notification delivery must re-check tenant status, feature entitlement, recipient status, guardian link state, provider state, and quiet-hours policy at send time.
3. Provider-disabled mode must fail closed or mark delivery as skipped; it must not claim that SMS/email/push was sent.
4. High-impact manual retries require reason and audit.
5. Emergency, security, transport-safety, and payment-security alerts cannot be silently dropped by preferences or quiet hours.
6. Callback processing must verify provider signatures and ignore duplicate or out-of-order state regressions.
7. Safe diagnostics may show bounded error category and provider status, but must not expose API keys, tokens, callback secrets, private file paths, or raw PII-heavy payloads.

---

## 5. Non-Negotiable Rules

- Keep M0 Platform Core inside the NestJS modular monolith.
- Keep the Notification Layer inside the modular monolith unless scale/compliance later justifies a separate service.
- Every school setting must be tenant-scoped by `tenantId`.
- Every platform action affecting tenants, plans, billing, support access, providers, queues, reports, onboarding, notification delivery, callback verification, or limits must be audited.
- School users must not access platform settings.
- Platform users must not enter tenant data silently; support override requires explicit reason and audit.
- Do not mix school fee collection with SchoolOS SaaS billing.
- Provider secrets must never be returned raw.
- Queue retry actions must be permission-guarded and audited.
- Notification retry actions must be idempotent and must re-check recipient/provider/tenant state at execution time.
- Frontend gating is display only; backend entitlement and permission checks must enforce access.
