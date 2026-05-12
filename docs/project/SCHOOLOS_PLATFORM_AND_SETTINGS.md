# SchoolOS Platform and Settings Guide

This file consolidates the former platform core memory and settings boundaries documents.

Source of truth for project-wide state:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Current repo/backend audit:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
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
M0 Platform Core Foundation Depth: Completed
Current work: stabilize existing platform/domain foundations, then deepen one vertical at a time.
```

Implemented/foundation areas:

```text
Platform Control Plane foundation
Tenant/settings boundary documentation
Generic File Registry foundation
Global API response/reporting direction
Usage/plan-service foundations
Platform audit direction
```

Remaining platform work:

```text
SaaS subscription and billing automation
API key management
Webhook system
Plan/feature entitlement enforcement depth
Platform health/queue/audit UI depth
Support access workflow polish
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
- School Operations Plane is for school workflows.
- School users must not access `/platform/*` routes.
- Platform support/tenant override must require an explicit reason and audit log.
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

### 5.1 School Profile

Used by receipts, ID cards, payslips, certificates, report cards, admissions, and public-facing school documents.

```text
School name
School address
Contact phone
Contact email
PAN / registration number
Principal name
Municipality / ward
District / province
School type
iEMIS school code
```

### 5.2 Branding and Documents

```text
School logo
School seal
Principal signature
Primary branding color
Receipt header/footer
ID card template
Payslip template
Certificate template
Report card template
Default paper size
PDF header/footer
```

### 5.3 Academic Settings

```text
Academic year
Active academic year
Classes
Sections
Subjects
Grading system
Exam terms
Promotion rules
Holiday calendar
Working days
Transfer certificate templates
```

Academic Settings may link to dedicated Academics pages when the workflow is too large for a settings form.

### 5.4 Fee and Finance Settings

This is school fee collection configuration, not SchoolOS SaaS billing.

```text
Fee heads
Fee plans
Fee periods
Active fee plan
Receipt number prefix
Payment methods
Discount rules
Waiver approval rules
Late fine rules
Cashier close settings
Receipt footer note
Fiscal year mapping
```

### 5.5 HR and Payroll Settings

```text
Leave types
Leave balance rules
Leave accrual rules
Payroll month rules
Working days per month
Salary component defaults
PF settings
TDS settings
Salary payment methods
Attendance-to-payroll rules
Payroll approval workflow
Payslip footer/signature
```

Operational payroll runs belong in the HR/Payroll module, not Settings. Settings stores rules and defaults.

### 5.6 Accounting Settings

School-level M9 accounting configuration.

```text
Fiscal years
Fiscal periods
Default chart of accounts
Default cash account
Default bank account
Fee income account mapping
Salary expense account
Salary payable account
TDS payable account
PF payable account
Journal numbering rules
Voucher numbering rules
Period lock/close policy
```

Accounting Settings may link to the Accounting module for full fiscal period, chart of accounts, and journal workflows.

### 5.7 Attendance Settings

```text
Attendance lock hours
Default attendance session time
Late threshold
Half-day threshold
Correction request approval rule
Teacher attendance permissions
Parent attendance visibility
Weekend/holiday rules
```

### 5.8 Communication Settings

SchoolOS Communication Settings include parent-teacher chat availability with structured time selectors in the School Settings UI instead of free-text hour ranges.

Current recommended default:

```text
Sunday–Thursday Start Time: 16:00
Sunday–Thursday End Time:   19:00
Friday Start Time:          14:00
Friday End Time:            17:00
Saturday Chat:              Disabled by default
Timezone:                   Asia/Kathmandu
```

Rules:

```text
- Chat hours must be configured using time selectors, not free-text values.
- Start time must be before end time.
- Saturday chat remains controlled by school policy.
- Messages outside configured chat hours should be accepted as queued unless marked as emergency by an authorized admin.
- Teachers should not be shown as instantly available outside configured school chat hours.
- Parent-facing wording should use expectations such as: Usually replies within 1 school day.
```

Future backend normalization target:

```text
chat_sun_thu_start_time
chat_sun_thu_end_time
chat_friday_start_time
chat_friday_end_time
chat_saturday_enabled
chat_timezone = Asia/Kathmandu
```

### 5.9 Security and Access Settings

```text
Role management
User management
Password policy display / school-level stricter policy if allowed
Session timeout preference if allowed
Sensitive staff field masking policy
Export permissions
School audit log viewer
Login audit viewer
```

Platform security baselines still override weak school-level settings.

### 5.10 Data Import / Export

```text
Student import
Guardian import
Fee import
iEMIS export
Class roster export
Payroll export
Accounting audit export
```

Exports must be tenant-scoped, permission-guarded, and audited.

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

### 6.1 Tenant / School Management

```text
Create school tenant
Approve/reject tenant registration
Activate/suspend school
Assign subscription plan
Set tenant slug
Set tenant domain/subdomain later
Tenant status
Tenant onboarding status
Support access status
```

### 6.2 Subscription and Billing

This is SchoolOS company billing, not student fee collection.

```text
Plans
Monthly/yearly pricing
Module access by plan
Student limits
Staff limits
Storage limits
SMS quota
AI feature limits later
School subscription invoice
Payment status
Trial period
Renewal date
```

### 6.3 Feature Flags / Module Access

Platform-controlled entitlement and rollout.

Examples:

```text
Enable/disable modules per tenant
Admissions
Attendance
Fees
HR Payroll
Accounting
Library later
Transport later
Canteen later
AI features later
```

UI may hide locked modules, but backend entitlement checks must enforce access.

### 6.4 Platform Security

```text
Global password policy baseline
JWT/cookie settings
Refresh token policy
Super-admin tenant override policy
IP allowlist later
2FA enforcement later
API key management later
Rate limiting
Login abuse protection
```

### 6.5 Provider Configuration

Platform-owned provider credentials and integration infrastructure.

```text
SMS provider keys
Email provider keys
Push notification provider keys
S3/MinIO/R2 storage settings
Payment gateway credentials
OCR/AI provider settings later
```

Schools may choose enabled/disabled preferences and see quotas, but they must not see raw provider API keys.

### 6.6 Infrastructure / System Health

```text
Database health
Redis health
Queue health
BullMQ jobs
Failed jobs
Storage usage
API health
Background worker status
PDF generation status
Notification delivery status
```

### 6.7 Audit and Compliance

```text
Platform audit logs
Super-admin tenant override logs
Sensitive data access logs
Export logs
Failed login logs
Tenant suspension logs
Billing change logs
Provider configuration change logs
```

Schools can view their own tenant audit logs. Platform can view platform-wide logs according to strict permissions.

### 6.8 Global Templates

Platform defaults copied into tenant-owned settings during onboarding.

```text
Default tenant setup templates
Default roles
Default permissions
Default chart of accounts
Default fee heads
Default notice templates
Default consent templates
Default certificate templates
Default receipt templates
```

After copying defaults into a tenant, the school may customize its own tenant-scoped copy where allowed.

### 6.9 Release / Maintenance Controls

```text
Maintenance mode
Announcement banners
Version info
Migration status
Feature rollout stages
Tenant-specific rollout
Bug report tools
Support access tools
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
| SMS provider API key | No | Yes |
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

Near-term priority after repo stabilization:

```text
1. Platform audit/usage visibility polish.
2. Plan/feature entitlement enforcement depth.
3. Tenant settings depth where it unblocks production workflows.
4. File Registry adoption for generated reports/files.
5. Usage limits and plan rules.
6. API Key Management only when integrations require it.
7. Webhook System only when external integrations require it.
8. SaaS Subscription and Billing before broad paid rollout.
```

Do not let platform work delay the immediate repo stabilization and Phase 2A admin UI/browser smoke work.

---

## 9. Near-Term Settings Implementation Recommendation

For the current implemented-foundations stage, Settings should evolve in this order:

```text
1. Keep /dashboard/settings as the school-level settings surface.
2. Add cards/tabs for:
   - School Profile
   - Fee Setup
   - Accounting Setup
   - HR & Payroll Setup
   - Attendance Rules
   - Security & Access
3. Keep /platform/dashboard and /platform/schools for platform management.
4. Add /platform/settings later for:
   - Plans
   - Module Access
   - Provider Config
   - Feature Flags
   - System Health
```

Do not build all settings at once. Add settings only when they unblock production workflows, pilot onboarding, security hardening, Phase 2/3 admin hardening, or production verification.

---

## 10. Non-Negotiable Rules

- Keep M0 Platform Core inside the NestJS modular monolith.
- Every school setting must be tenant-scoped by `tenantId`.
- Every platform action affecting tenants, plans, billing, support access, providers, or limits must be audited.
- School users must not access platform settings.
- Platform users must not enter tenant data silently; support override requires explicit reason and audit.
- Do not mix school fee collection with SchoolOS SaaS billing.
- UI visibility is not security; backend guards, entitlements, permissions, and tenant filters enforce access.
- Frontend gating is display only; backend entitlement and permission checks must enforce access.
- Keep all settings inside the modular monolith for now.
- Do not introduce microservices just to separate school/platform settings.
