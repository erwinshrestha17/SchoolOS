# SchoolOS Platform UI/UX Optimization Plan

## Purpose

The M0 Platform Control Plane is for SchoolOS operators, not school staff. It must help platform users manage tenants, SaaS subscriptions, provider readiness, queue health, audit logs, onboarding, and support access safely.

Core principle: each platform screen has one main operational job and one primary action.

## Control-plane boundaries

| Area | Route family | Owner | Purpose |
| --- | --- | --- | --- |
| Platform Control Plane | `/platform/*` | SchoolOS platform operators | Cross-tenant SaaS operations, subscriptions, providers, queues, audit, support override |
| Tenant Configuration Plane | `/dashboard/settings/*` | School admins | One school's local settings, branding, academic year, preferences |
| School Operations Plane | `/dashboard/*` | School users | Students, attendance, fees, academics, notices, HR, daily workflows |

Billing boundary:

- M0 SaaS Billing is SchoolOS charging schools for using SchoolOS.
- M3 Fees is schools collecting fees from students or guardians.
- M9 Accounting is the school's internal ledger/accounting.

Never mix M0 SaaS invoices/payments with M3 student fee receipts or M9 school ledger screens.

## Route map

| Route | Screen job | Primary action |
| --- | --- | --- |
| `/platform/dashboard` | Show what needs platform attention today | View schools or attention items |
| `/platform/schools` | Find and manage school tenants | Onboard new school |
| `/platform/schools/[tenantId]` | Understand and safely manage one school | Open support access or view billing |
| `/platform/billing` | Route SaaS billing work | View subscriptions |
| `/platform/billing/subscriptions` | Manage school subscriptions | Select school subscription |
| `/platform/billing/invoices` | Track SchoolOS SaaS invoices | View unpaid invoices |
| `/platform/billing/payments` | Review SchoolOS SaaS payment records | View recent payments |
| `/platform/settings/plans` | Configure SaaS plans and limits | Review plans |
| `/platform/settings/modules` | Review module and feature availability | Review module availability |
| `/platform/settings/providers` | Configure and verify providers | Run readiness check |
| `/platform/settings/feature-flags` | Control platform feature rollout | Review flags |
| `/platform/operations/health` | Check infrastructure readiness | Open health details |
| `/platform/operations/queues` | Diagnose and retry failed jobs safely | Inspect failed jobs |
| `/platform/operations/audit` | Answer who did what, when, and why | Filter audit logs |
| `/platform/operations/reports` | Review generated platform reports | View report history |

Thin wrapper routes may redirect to existing implemented tabs while the UI is being split. Wrappers must not introduce fake data.

## Navigation groups

Platform: Dashboard, Schools.

Billing: Subscriptions, SaaS Invoices, Payments, Plans.

Operations: System Health, Queue Health, Audit Logs, Reports.

Configuration: Modules / Features, Providers, Feature Flags.

Only show implemented routes. All platform links must remain platform-only and permission-gated.

## Screen rules

### Dashboard

Purpose: show what needs attention today.

Show active schools, suspended schools, onboarding incomplete schools, overdue SaaS invoices, failed jobs, provider issues, usage warnings, and recent platform audit activity. Avoid decorative charts and unrelated school operation metrics.

### Schools list

Purpose: find and manage tenants.

Support search, status/plan/subscription/onboarding/provider filters where data exists, and row actions for details, billing, and support access. Dangerous lifecycle actions require confirmation, reason, permission, and audit note.

### Tenant detail

Purpose: understand and safely manage one school.

Use tabs for Overview, Subscription, Usage, Features, Onboarding, Support Access, Audit Logs, and Files / Reports when supported. Support access must never be silent.

### Providers

Purpose: configure and verify platform providers.

Provider cards should show readiness status, masked config, last checked timestamp where available, safe readiness message, and run check/configure actions. Never show raw secrets.

### Queues

Purpose: diagnose and retry failed jobs safely.

Show queue summary cards, failed jobs, redacted payload detail, retry confirmation with reason, and retry audit note. No raw PII or secrets.

### Audit logs

Purpose: answer who did what, when, and why.

Support filters, paginated table, detail view, reason/request id where available, and permissioned export.

## Loading, empty, and error states

For every platform list: default to an empty array, show skeletons during loading, helpful empty states, inline errors with retry, and avoid full-page spinners except route-level redirects.

## Dangerous action rules

Dangerous actions include suspending/reactivating tenants, opening support override, retrying failed jobs, discarding failed jobs, changing active plan rules, cancelling SaaS invoices, and rotating/disabling provider secrets.

Every dangerous action must include confirmation, reason field, clear warning, permission check, and audit log expectation.

## Implementation order

1. Normalize platform route map and sidebar groups.
2. Add thin wrapper routes for focused destinations that reuse existing tabs.
3. Redesign `/platform/dashboard` as an attention queue.
4. Redesign `/platform/schools` as a tenant operations table.
5. Redesign `/platform/schools/[tenantId]` with purpose-based tabs.
6. Split providers, queues, audit, and billing into focused pages when backend/API support is stable.
7. Add browser smoke tests for platform-only navigation and safe empty states.

## Guardrails

- Frontend-first M0 only.
- No M1-M10 feature work.
- No Angular migration.
- No microservices.
- No fake production data.
- Keep `tenantId` as the school boundary.
