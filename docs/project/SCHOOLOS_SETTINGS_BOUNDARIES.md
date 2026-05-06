# SchoolOS Settings Boundaries

This document defines what belongs in school-level settings versus platform-level settings in SchoolOS.

SchoolOS has two settings surfaces:

```text
1. School Management Settings
   Used by each school/admin/principal/accountant to configure one tenant's daily operations.

2. Platform Management Settings
   Used by the SchoolOS owner/developers/platform team to manage SaaS-wide behavior.
```

The separation is critical for tenant isolation, SaaS billing correctness, security, auditability, and maintainability.

## Core Rule

```text
If the setting changes one school's daily operation, it belongs in School Settings.

If the setting changes SaaS ownership, billing, infrastructure, provider credentials, tenant access, feature flags, or global defaults, it belongs in Platform Settings.
```

## School Management Settings

School Management Settings are tenant-owned settings for one school. They must always be scoped by `tenantId`.

Recommended route/API namespace:

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

School users must never be allowed to change SaaS-level platform billing, provider credentials, or global infrastructure settings.

### A. School Profile

Used by receipts, ID cards, payslips, certificates, report cards, admissions, and public-facing school documents.

Fields:

```text
School name
School address
Contact phone
Contact email
PAN / registration number
Principal name
Municipality / ward
District / province
School type: Montessori / Basic / Secondary
iEMIS school code
```

### B. Branding and Documents

School-specific branding for documents and dashboard presentation.

Fields/configuration:

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

### C. Academic Settings

School-level academic configuration.

Fields/configuration:

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

### D. Fee and Finance Settings

School-level fee collection configuration. This is different from SchoolOS SaaS billing.

Fields/configuration:

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

The dashboard setup alert `Configure an active fee plan` belongs to this area.

### E. HR and Payroll Settings

School-specific HR/payroll rules.

Fields/configuration:

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

### F. Accounting Settings

School-level M9 accounting configuration.

Fields/configuration:

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

### G. Attendance Settings

School-level attendance behavior.

Fields/configuration:

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

### H. Communication Settings

SchoolOS Communication Settings now represent parent-teacher chat availability with structured time selectors in the School Settings UI instead of free-text hour ranges.

Current UI behavior:

```text
Sunday–Thursday Start Time: 16:00
Sunday–Thursday End Time:   19:00
Friday Start Time:          14:00
Friday End Time:            17:00
Saturday Chat:              Disabled by default
Timezone:                   Asia/Kathmandu
```

The settings screen also shows a read-only availability preview for school admins:

```text
Sunday–Thursday: 4:00 PM – 7:00 PM
Friday: 2:00 PM – 5:00 PM
Saturday: Closed or Enabled by school policy
```

Rules:

* Chat hours must be configured using time selectors, not free-text values.
* Start time must be before end time.
* Saturday chat remains controlled by school policy.
* Messages outside configured chat hours should be accepted as queued unless marked as emergency by an authorized admin.
* Teachers should not be shown as instantly available outside configured school chat hours.
* Parent-facing wording should use expectations such as `Usually replies within 1 school day`.

Current implementation note:

* The frontend maps structured start/end time fields back to existing tenant setting key/value strings.
* Backend schema normalization is deferred.

Future backend normalization target:

```text
chat_sun_thu_start_time
chat_sun_thu_end_time
chat_friday_start_time
chat_friday_end_time
chat_saturday_enabled
chat_timezone = Asia/Kathmandu
```

### I. Security and Access Settings

School-level security controls that do not override platform security baselines.

Fields/configuration:

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

### J. Data Import / Export

School-owned data import/export tools.

Features:

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

## Recommended School Settings Route Structure

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

## Platform Management Settings

Platform Management Settings belong to the SchoolOS SaaS owner/operator. They affect multiple tenants, commercial packaging, infrastructure, provider credentials, feature rollout, and support access.

Recommended route/API namespace:

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

School users must never access `/platform/*` routes.

### A. Tenant / School Management

Platform-level school customer administration.

Fields/actions:

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

### B. Subscription and Billing

This is SchoolOS company billing, not student fee collection.

Fields/configuration:

```text
Plans: Basic / Standard / Premium / Enterprise
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

Important distinction:

```text
M3/M9 school finance = school collects money from students/parents.
SaaS billing = SchoolOS company charges schools for using SchoolOS.
```

### C. Feature Flags / Module Access

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

Example packaging:

```text
School A: Fees + Attendance only
School B: Fees + Attendance + HR + Accounting
School C: Full suite
```

UI may hide locked modules, but backend entitlement checks must enforce access.

### D. Platform Security

Global security baseline and platform-only controls.

Configuration:

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

Schools may have limited local preferences, but platform security sets the minimum allowed baseline.

### E. Provider Configuration

Platform-owned provider credentials and integration infrastructure.

Configuration:

```text
SMS provider keys
Email provider keys
Push notification provider keys
S3/MinIO/R2 storage settings
Payment gateway credentials
OCR/AI provider settings later
```

Schools may choose enabled/disabled preferences and see quotas, but they must not see raw provider API keys.

### F. Infrastructure / System Health

Platform/dev operations visibility.

Views:

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

### G. Audit and Compliance

Platform-wide audit visibility.

Logs:

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

### H. Global Templates

Platform defaults copied into tenant-owned settings during onboarding.

Templates:

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

### I. Release / Maintenance Controls

Platform-only operational controls.

Features:

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

## Recommended Platform Settings Route Structure

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

## Separation Matrix

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
| SaaS invoice to school | No or read-only billing page later | Yes |
| Receipt paid by parent/student | Yes | No |

## Near-Term Implementation Recommendation

For the current Phase 2C/2D stage, Settings should evolve in this order:

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

Do not build all settings at once. Add settings only when they unblock production workflows, pilot onboarding, security hardening, or Phase 2 operational depth.

## Non-Negotiable Rules

- Every school setting must be tenant-scoped by `tenantId`.
- Every platform setting that affects tenants, plans, support access, billing, providers, or feature flags must be audited.
- School users must not access platform settings.
- Platform users must not enter tenant data silently; support override requires explicit reason and audit.
- Do not mix school fee collection with SchoolOS SaaS billing.
- UI visibility is not security; backend guards and tenant filters enforce access.
- Keep all settings inside the modular monolith for now.
- Do not introduce microservices just to separate school/platform settings.
