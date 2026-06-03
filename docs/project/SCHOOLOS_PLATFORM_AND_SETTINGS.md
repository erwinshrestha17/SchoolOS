# SchoolOS Platform and Settings Guide

This file is the active guide for SchoolOS platform control, tenant settings, and school settings boundaries.

Project-wide source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Current implementation status and phase plan:

```text
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
```

---

## 1. Purpose

SchoolOS has separate platform and school settings surfaces. This separation is required for tenant isolation, SaaS billing correctness, school finance correctness, security, auditability, and maintainability.

Core rule:

```text
If the setting changes one school's daily operation, it belongs in School Settings.
If the setting changes SaaS ownership, billing, infrastructure, provider credentials, tenant access, feature flags, or global defaults, it belongs in Platform Settings.
```

---

## 2. Current M0 Platform Core Status

```text
M0 Platform Core Foundation: Completed across eight sprints.
Current work: staging verification, browser coverage, entitlement enforcement, provider readiness, queue/File Registry hardening, and pilot reliability.
```

M0 remains inside the existing NestJS modular monolith. It is not a separate microservice and should not be split unless future scale, team ownership, deployment isolation, or compliance requirements clearly justify that cost and the owner explicitly requests it.

Implemented M0 foundation areas:

```text
Platform tenant list/detail/dashboard/status flows
Reason-required tenant suspend/activate actions
Platform tenant subscription plan-change workflow with audit reason
Reasoned, time-bound support override entry from tenant detail
Tenant SaaS invoice create/payment/cancel actions and billing profile edit workflow
Tenant onboarding checklist detail and audited override workflow
Plan, feature, subscription, override, and usage-counter foundations
Provider config masking and secret-safe response shape
Provider readiness detail API with dry-run validation
Queue health plus audited retry/discard operator workflows
Failed-job detail inspection with sanitized payloads and retry audit history
File upload validation and dangerous extension blocking
Private/protected file URL response shape
Report export history and audited export persistence
Platform health summary for DB, Redis, queues, and storage readiness
```

Remaining M0 hardening work:

```text
Async report/export generation expansion module by module
Provider test connection stays conservative/dry-run by default
Seed data coverage for dashboard smoke routes
Credentialed web E2E coverage where seeded credentials and local ports are available
Deeper platform/school route-denial browser tests
SaaS billing lifecycle tests
Entitlement enforcement tests against real school APIs
Object-storage readiness verification against explicit staging provider
Docker-backed smoke once Postgres, Redis, and API are running
```

---

## 3. Three-Plane SaaS Architecture

| Plane | Audience | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/accounting`, `/library`, `/transport`, `/canteen` |

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for one school's own settings.
- School Operations Plane is for daily school workflows.
- School users must not access `/platform/*` routes.
- Platform support/tenant override must require explicit reason and audit log.
- Keep all planes inside the modular monolith for now.

---

## 4. Critical Billing Boundary

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using SchoolOS.
```

Do not mix school fee collection with platform SaaS billing.

Examples:

```text
Student receipt, fee invoice, cashier close, school ledger -> M3/M9 school finance.
School subscription, plan, SMS quota, AI credits, module entitlement -> M0 platform/SaaS billing.
```

M0 SaaS billing records must not post directly into school tenant fee ledgers. Any future internal SchoolOS company accounting must be modeled separately from a tenant school's M3/M9 accounting domain.

---

## 5. School Management Settings

School Management Settings are tenant-owned settings for one school. They must always be scoped by `tenantId`.

Recommended namespace:

```text
Frontend: /dashboard/settings/*
Backend:  /settings/* or /tenant-settings/*
```

Typical users:

```text
School Admin
Principal
Accountant
HR/Admin
Academic Coordinator
```

School users must never change SaaS-level platform billing, provider credentials, or global infrastructure settings.

Recommended school settings areas:

```text
School Profile
Branding and Documents
Academic Settings
Fee and Finance Settings
HR and Payroll Settings
Accounting Settings
Attendance Settings
Communication Settings
Security and Access Settings
Data Import / Export
Audit Viewer
```

Recommended school settings routes:

```text
/dashboard/settings
/dashboard/settings/school-profile
/dashboard/settings/branding
/dashboard/settings/academic
/dashboard/settings/fees
/dashboard/settings/hr-payroll
/dashboard/settings/accounting
/dashboard/settings/attendance
/dashboard/settings/communication
/dashboard/settings/security
/dashboard/settings/import-export
/dashboard/settings/audit
```

School-level exports must be tenant-scoped, permission-guarded, and audited.

---

## 6. Platform Management Settings

Platform Management Settings belong to the SchoolOS SaaS owner/operator. They affect multiple tenants, commercial packaging, infrastructure, provider credentials, feature rollout, and support access.

Recommended namespace:

```text
Frontend: /platform/settings/*
Backend:  /platform/settings/* or /platform/*
```

Typical users:

```text
Platform Super Admin
Platform Support
Platform Billing Admin
Developer/Ops team
```

Recommended platform settings areas:

```text
Tenant / School Management
Subscription and Billing
Feature Flags / Module Access
Platform Security
Provider Configuration
Infrastructure / System Health
Audit and Compliance
Global Templates
Release / Maintenance Controls
```

Recommended platform routes:

```text
/platform/dashboard
/platform/schools
/platform/schools/[tenantId]
/platform/settings
/platform/settings/plans
/platform/settings/modules
/platform/settings/providers
/platform/settings/security
/platform/settings/feature-flags
/platform/settings/system-health
/platform/settings/audit
/platform/settings/default-templates
```

Schools may choose enabled/disabled preferences and see quotas, but they must not see raw provider API keys.

---

## 7. Separation Matrix

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
| School SMS preference | Yes | Quota/policy/provider control |
| Database/Redis health | No | Yes |
| Tenant creation/suspension | No | Yes |
| Super-admin tenant override | No | Yes |
| Audit logs | Own school only | Platform-wide |
| Default templates | Customize own copy | Define global defaults |
| SaaS invoice to school | No/read-only billing page later | Yes |
| Receipt paid by parent/student | Yes | No |

---

## 8. Platform Core Priority Order

Near-term priority:

```text
1. Run Docker-backed smoke with Postgres, Redis, API, and web running.
2. Add platform/school route denial browser tests.
3. Add SaaS billing lifecycle tests.
4. Add entitlement enforcement tests against real school APIs.
5. Deepen BullMQ failed-job inspection for deployed queue topology.
6. Expand async report/export generation module by module.
7. Expand demo Nepal pilot tenant seed data.
8. Polish platform audit/usage visibility.
9. Add API-key management UI only when integrations require it.
10. Add webhook system only when external integrations require it.
```

Do not let platform work delay immediate repo stabilization and pilot verification.

---

## 9. Near-Term Settings Implementation Recommendation

For the current implemented-foundations stage, Settings should evolve in this order:

```text
1. Keep /dashboard/settings as the school-level settings surface.
2. Add cards/tabs for School Profile, Fee Setup, Accounting Setup, HR & Payroll Setup, Attendance Rules, Security & Access.
3. Keep /platform/dashboard and /platform/schools for platform management.
4. Add /platform/settings later for Plans, Module Access, Provider Config, Feature Flags, and System Health.
```

Do not build all settings at once. Add settings only when they unblock production workflows, pilot onboarding, security hardening, Phase 2/3 admin hardening, or production verification.

---

## 10. Non-Negotiable Rules

- Keep M0 Platform Core inside the NestJS modular monolith.
- Every school setting must be tenant-scoped by `tenantId`.
- Every platform action affecting tenants, plans, billing, support access, providers, queues, reports, onboarding, or limits must be audited.
- School users must not access platform settings.
- Platform users must not enter tenant data silently; support override requires explicit reason and audit.
- Do not mix school fee collection with SchoolOS SaaS billing.
- Provider secrets must never be returned raw.
- Queue retry actions must be permission-guarded and audited.
- UI visibility is not security; backend guards, entitlements, permissions, and tenant filters enforce access.
- Frontend gating is display only; backend entitlement and permission checks must enforce access.
- Keep all settings inside the modular monolith for now.
- Do not introduce microservices just to separate school/platform settings.
