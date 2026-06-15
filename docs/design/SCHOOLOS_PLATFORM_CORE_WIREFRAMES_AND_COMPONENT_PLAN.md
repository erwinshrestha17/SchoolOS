# SchoolOS Platform Core Wireframes and Component Plan

**Status:** Companion design and component planning guide for SchoolOS Platform Core / SaaS Admin.  
**Scope:** Platform admin design planning only. This document does not implement backend, frontend, mobile, API, database, migrations, or tests.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_LOW_FIDELITY_WIREFRAMES.md`
- `docs/design/SCHOOLOS_WEB_COMPONENT_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_SETTINGS_WIREFRAMES.md`

Platform Core is different from school Settings:

```text
Settings = school-level configuration
Platform = SaaS owner / developer / super admin configuration
```

Platform should be visible only to:

```text
Super Admin
Platform Admin
Developer Admin
Support Admin
Billing Admin
```

Guardrails:

- M0 Platform Core is developer/platform-admin only and is not part of school pricing tiers.
- Keep `tenantId` as the tenant boundary everywhere.
- Support access to tenant data must require audited override and least-privilege permissions.
- No tenant-private data should be visible to platform operators unless explicitly needed and audited.
- Provider secrets must be masked.
- Dangerous platform actions require reason, confirmation, permission, audit log, and clear impact preview.
- Platform plan/module access must not become an M9 accounting microservice.
- AI-related feature flags must remain disabled/roadmap-only until reliable production data and explicit approval exist.
- Use real APIs only; no fake platform metrics.

---

## 1. Platform Core Main Purpose

Platform Core manages:

```text
Tenants / Schools
Subscription Plans
Module Access
Feature Flags
RBAC Defaults
System Health
Queue Health
Storage Health
File Registry
Audit Logs
Backups
Billing
Support Tools
Global Settings
```

---

## 2. Platform App Shell Wireframe

Platform admin can use the same overall shell style but with a dedicated platform sidebar.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top Bar                                                                      │
│ SchoolOS Platform | Environment: Production | Search | Alerts | Super Admin  │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Platform Aside    │ Platform Main Workspace                                  │
│                   │                                                          │
│ Platform Dashboard│ Selected platform page appears here                      │
│ Tenants           │                                                          │
│ Plans & Billing   │                                                          │
│ Module Access     │                                                          │
│ Feature Flags     │                                                          │
│ Users & Admins    │                                                          │
│ RBAC Templates    │                                                          │
│ File Registry     │                                                          │
│ Audit Logs        │                                                          │
│ System Health     │                                                          │
│ Queues & Jobs     │                                                          │
│ Storage           │                                                          │
│ Backups           │                                                          │
│ Support Tools     │                                                          │
│ Global Settings   │                                                          │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

Rules:

- Do not mix school Settings navigation with Platform Core navigation.
- Platform pages must show environment context clearly.
- Production environment actions need stronger confirmation than staging/dev actions.
- Support override state must be visible at all times while active.

---

## 3. Platform Dashboard Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Dashboard                                                           │
│ Monitor all schools, subscriptions, users, storage, system health and alerts. │
│                                                 [Create Tenant] [View Alerts]│
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Schools│ │ Active Users │ │ Monthly Rev. │ │ System Health│
│ 128          │ │ 18,450       │ │ Rs. 18.4L    │ │ Healthy      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Storage Used │ │ Failed Jobs  │ │ Open Tickets │ │ Trial Tenants│
│ 1.8 TB       │ │ 12           │ │ 8            │ │ 14           │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Tenant Activity                       │ │ Platform Alerts                     │
│--------------------------------------│ │-------------------------------------│
│ Holyland Kids' Academy   Active       │ │ High: 5 failed payment webhooks      │
│ ABC School               Active       │ │ Medium: Queue retry rate increasing  │
│ Rupandehi Model School   Trial        │ │ Low: Tenant storage above 80%         │
│ Butwal Academy           Suspended    │ │ Low: 3 subscriptions expiring soon    │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ System Health Summary                 │ │ Recent Platform Activity             │
│--------------------------------------│ │-------------------------------------│
│ API              Healthy              │ │ Tenant created: ABC School            │
│ Database         Healthy              │ │ Module enabled: Transport             │
│ Redis            Healthy              │ │ Admin user invited                    │
│ Object Storage   Warning              │ │ Backup completed                      │
│ Queue Workers    Healthy              │ │ Failed job retried                    │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Dashboard sections:

- Platform KPI grid.
- Tenant activity.
- Platform alerts.
- System health summary.
- Recent platform activity.
- Trial/expiring/suspended tenant attention queue.

---

## 4. Tenants / Schools Wireframe

### Tenant List

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenants                                                                      │
│ Manage all schools, tenant status, domains, plans, storage and modules.       │
│                                                        [Create Tenant]        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search school... | Status ▼ | Plan ▼ | Region ▼ | Storage ▼ | [Export]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant Table                                                                 │
│------------------------------------------------------------------------------│
│ School | Domain | Plan | Status | Users | Storage | Health | Modules | Action │
│------------------------------------------------------------------------------│
│ Holyland Kids' Academy | holyland.schoolos.app | Pro | Active | 45 | 2GB | OK │
│ ABC School            | abc.schoolos.app      | Basic | Trial | 18 | 700MB|OK │
│ Butwal Academy        | butwal.schoolos.app   | Pro | Suspended | 64 | 5GB|Warn│
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tenant Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Tenant Detail                                │
│ Holyland Kids' Academy                       │
├──────────────────────────────────────────────┤
│ Status: Active                               │
│ Plan: Pro                                    │
│ Domain: holyland.schoolos.app                │
│ Region: Nepal                                │
│ Created: 2082-01-15                          │
│                                              │
│ Usage Summary                                │
│ Users: 45 / 100                              │
│ Students: 450 / 1000                         │
│ Storage: 2GB / 20GB                          │
│ Modules: 10 enabled                          │
│                                              │
│ [Open Tenant]                                │
│ [Edit Tenant]                                │
│ [Manage Modules]                             │
│ [Suspend Tenant]                             │
│ [View Audit Logs]                            │
└──────────────────────────────────────────────┘
```

### Create Tenant Wizard

```text
┌──────────────────────────────────────────────┐
│ Create Tenant Wizard                         │
├──────────────────────────────────────────────┤
│ Step 1: School Details                       │
│ Step 2: Domain & Region                      │
│ Step 3: Plan Selection                       │
│ Step 4: Module Access                        │
│ Step 5: Admin User                           │
│ Step 6: Review & Create                      │
│                                              │
│ Current Step: School Details                 │
│ School Name: [                         ]     │
│ Email:       [                         ]     │
│ Phone:       [                         ]     │
│ Address:     [                         ]     │
│                                              │
│ [Cancel] [Next]                              │
└──────────────────────────────────────────────┘
```

Tenant rules:

- Creating a tenant should initialize tenant defaults, not seed fake school data.
- Tenant suspend/reactivate must require reason and audit.
- Opening tenant context must show support override state and scope.

---

## 5. Plans and Billing Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plans & Billing                                                              │
│ Manage subscription plans, billing cycles, invoices and tenant limits.        │
│                                                        [Create Plan]          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Plan Cards                                                                    │
│                                                                              │
│ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐        │
│ │ Basic              │ │ Pro                │ │ Enterprise          │        │
│ │ Rs. X/month        │ │ Rs. Y/month        │ │ Custom              │        │
│ │ Students: 500      │ │ Students: 1500     │ │ Unlimited           │        │
│ │ Storage: 5GB       │ │ Storage: 20GB      │ │ Custom Storage      │        │
│ │ Modules: Core      │ │ Modules: Most      │ │ All Modules         │        │
│ │ [Edit Plan]        │ │ [Edit Plan]        │ │ [Edit Plan]         │        │
│ └────────────────────┘ └────────────────────┘ └────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Billing Table                                                                 │
│------------------------------------------------------------------------------│
│ Tenant | Plan | Billing Cycle | Status | Next Billing | Amount | Actions     │
│------------------------------------------------------------------------------│
│ Holyland Kids' Academy | Pro | Monthly | Paid | Ashad 30 | Rs. X | View      │
│ ABC School | Basic | Trial | Trial | 12 days left | Rs. 0 | Convert          │
│ Butwal Academy | Pro | Monthly | Overdue | Yesterday | Rs. X | Remind        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Plan Editor Drawer

```text
┌──────────────────────────────────────────────┐
│ Plan Editor                                  │
├──────────────────────────────────────────────┤
│ Plan Name: [ Pro ]                           │
│ Monthly Price: [ Rs.        ]                │
│ Max Students: [ 1500 ]                       │
│ Max Staff: [ 150 ]                           │
│ Storage Limit: [ 20 GB ]                     │
│                                              │
│ Included Modules                             │
│ [✓] Admissions                               │
│ [✓] Attendance                               │
│ [✓] Fees                                     │
│ [✓] Academics                                │
│ [✓] Communication                            │
│ [✓] HR                                       │
│ [✓] Library                                  │
│ [ ] Transport                                │
│ [ ] Canteen                                  │
│ [ ] Accounting                               │
│                                              │
│ [Cancel] [Save Plan]                         │
└──────────────────────────────────────────────┘
```

Billing rules:

- SaaS billing is separate from school fee collection.
- Money fields must use Decimal/numeric-safe backend contracts.
- Plan changes require impact preview for affected tenants.

---

## 6. Module Access Wireframe

This controls which modules each tenant can use.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Access                                                                │
│ Enable, disable, lock or unlock SchoolOS modules per tenant or plan.          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant: [ Holyland Kids' Academy ▼ ] | Plan: Pro | Status: Active            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Access Matrix                                                          │
│------------------------------------------------------------------------------│
│ Module              Included in Plan   Enabled for Tenant   Lock Reason       │
│------------------------------------------------------------------------------│
│ Admissions          Yes                Enabled              -                 │
│ Attendance          Yes                Enabled              -                 │
│ Fees                Yes                Enabled              -                 │
│ Academics           Yes                Enabled              -                 │
│ Activity Feed       Yes                Enabled              -                 │
│ Homework            Yes                Enabled              -                 │
│ HR & Payroll        Yes                Enabled              -                 │
│ Library             Yes                Enabled              -                 │
│ Transport           No                 Locked               Upgrade required  │
│ Canteen             No                 Locked               Upgrade required  │
│ Accounting          Yes                Enabled              -                 │
│ Communication       Yes                Enabled              -                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Save Module Access] [Apply Plan Defaults] [View Tenant Impact]              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- School-level Settings may hide modules, but platform controls SaaS entitlement.
- Direct route access must still enforce module entitlement.
- Disabled modules must show `ModuleLockedState`, not fake data.

---

## 7. Feature Flags Wireframe

Feature flags help release new features safely.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Feature Flags                                                                │
│ Control experimental, beta and staged rollout features.                       │
│                                                        [Create Feature Flag]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search flag... | Module ▼ | Environment ▼ | Status ▼ | Rollout ▼             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Feature Flag Table                                                            │
│------------------------------------------------------------------------------│
│ Flag Key | Module | Environment | Status | Rollout | Tenants | Actions       │
│------------------------------------------------------------------------------│
│ m10.chat.v2       | Communication | Production | Enabled | 20% | 12 | Edit   │
│ m6.timetable.ai   | Timetable     | Staging    | Disabled| 0%  | 0  | Edit   │
│ m8b.live.gps      | Transport     | Production | Disabled| 0%  | 0  | Edit   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Feature Flag Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Feature Flag Detail                          │
├──────────────────────────────────────────────┤
│ Key: m10.chat.v2                             │
│ Module: Communication                        │
│ Environment: Production                      │
│ Status: Enabled                              │
│ Rollout: 20%                                 │
│                                              │
│ Targeting                                    │
│ [✓] Specific tenants                         │
│ [ ] Specific plans                           │
│ [ ] Percentage rollout                       │
│                                              │
│ Enabled Tenants                              │
│ Holyland Kids' Academy                       │
│ ABC School                                   │
│                                              │
│ [Disable] [Edit Targeting] [View Audit]      │
└──────────────────────────────────────────────┘
```

Rules:

- Feature flags must be auditable.
- Production flags need rollback path.
- AI-related flags must remain disabled/roadmap-only until explicitly approved.

---

## 8. Platform Users and Admins Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Users & Admins                                                      │
│ Manage SaaS owner admins, support users, billing users and developer admins.  │
│                                                        [Invite Admin]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search admin... | Role ▼ | Status ▼ | Last Login ▼                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Admin Table                                                                   │
│------------------------------------------------------------------------------│
│ Name | Email | Platform Role | Status | Last Login | 2FA | Actions           │
│------------------------------------------------------------------------------│
│ Erwin | erwin@... | Super Admin | Active | Today | Enabled | Edit            │
│ Support 1 | support@... | Support Admin | Active | Yesterday | Enabled | Edit│
│ Billing 1 | billing@... | Billing Admin | Invited | Never | Pending | Resend │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Platform admin invitations must be audited.
- Disabling a platform admin requires confirmation and reason.
- Platform roles must never be confused with school roles.

---

## 9. RBAC Templates Wireframe

This defines default role permissions used when a new tenant is created.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ RBAC Templates                                                               │
│ Manage default school roles and permissions for newly created tenants.        │
│                                                        [Create Template]      │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────────────────────────────────────┐
│ Role Templates        │ Permission Matrix                                    │
│-----------------------│------------------------------------------------------│
│ Principal             │ Module        View Create Edit Approve Export Delete │
│ Admin                 │------------------------------------------------------│
│ Teacher               │ Admissions    ✓    ✓      ✓    -       ✓      -      │
│ Class Teacher         │ Attendance    ✓    ✓      ✓    ✓       ✓      -      │
│ Accountant            │ Fees          ✓    ✓      ✓    ✓       ✓      -      │
│ Librarian             │ Library       ✓    ✓      ✓    -       ✓      -      │
│ Transport Manager     │ Transport     ✓    ✓      ✓    -       ✓      -      │
│ Parent                │ Student Data  Own  -      -    -       -      -      │
│ Student               │ Homework      Own  -      -    -       -      -      │
└───────────────────────┴──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Save Template] [Apply to New Tenants] [Compare Tenant Overrides]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- RBAC templates are defaults only.
- Existing tenant overrides require compare/preview before changes.
- Parent and student permissions must remain own-scope only.

---

## 10. File Registry Wireframe

Platform-wide view of protected files across tenants.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ File Registry                                                                │
│ Monitor protected files, storage usage, access logs and orphaned files.       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant ▼ | Module ▼ | File Type ▼ | Status ▼ | Date Range ▼ | [Export]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ File Table                                                                    │
│------------------------------------------------------------------------------│
│ File Name | Tenant | Module | Type | Size | Owner | Status | Last Accessed   │
│------------------------------------------------------------------------------│
│ receipt-001.pdf | Holyland | Fees | PDF | 120KB | System | Active | Today    │
│ student-photo.jpg | ABC | Admissions | Image | 800KB | Admin | Active | Today │
│ old-export.csv | Butwal | iEMIS | CSV | 2MB | Admin | Orphaned | 60 days ago │
└──────────────────────────────────────────────────────────────────────────────┘
```

### File Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ File Detail                                  │
├──────────────────────────────────────────────┤
│ File: receipt-001.pdf                        │
│ Tenant: Holyland Kids' Academy               │
│ Module: Fees                                 │
│ Size: 120KB                                  │
│ Status: Active                               │
│ Storage Path: protected/...                  │
│                                              │
│ Access Logs                                  │
│ Admin previewed today                        │
│ Accountant downloaded yesterday              │
│                                              │
│ [Preview] [Download] [View Audit]            │
└──────────────────────────────────────────────┘
```

Rules:

- Platform file preview/download requires audited access and permission.
- Storage paths must not expose secrets or signed URLs directly.
- Orphan cleanup requires preview and reason.

---

## 11. Audit Logs Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Platform Audit Logs                                                          │
│ Track sensitive actions across tenants and platform administration.           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant ▼ | User ▼ | Module ▼ | Action ▼ | Severity ▼ | Date Range ▼ | Export │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Audit Log Table                                                               │
│------------------------------------------------------------------------------│
│ Time | Tenant | User | Module | Action | Severity | IP | Details             │
│------------------------------------------------------------------------------│
│ 09:30 | Holyland | Admin | Fees | Payment reversed | High | ... | View       │
│ 09:15 | ABC | Platform Admin | Modules | Transport enabled | Medium | ...    │
│ 08:45 | System | Worker | Queue | Job failed | Medium | ... | View           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Audit Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Audit Detail                                 │
├──────────────────────────────────────────────┤
│ Action: Payment reversed                     │
│ Tenant: Holyland Kids' Academy               │
│ User: Accountant                             │
│ Severity: High                               │
│ Time: Today 09:30                            │
│ IP: xxx.xxx.xxx.xxx                          │
│                                              │
│ Before                                       │
│ Payment Status: Paid                         │
│                                              │
│ After                                        │
│ Payment Status: Reversed                     │
│                                              │
│ Reason                                       │
│ Duplicate payment entry                      │
│                                              │
│ [Export Audit] [Open Tenant Record]          │
└──────────────────────────────────────────────┘
```

Rules:

- Audit export requires permission.
- Before/after values must redact secrets and sensitive data.
- Platform support actions must be visible in audit logs.

---

## 12. System Health Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ System Health                                                                │
│ Monitor API, database, Redis, object storage, queues and workers.             │
│                                                        [Refresh Health]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ API          │ │ Database     │ │ Redis        │ │ Storage      │
│ Healthy      │ │ Healthy      │ │ Healthy      │ │ Warning      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Queue Worker │ │ PDF Worker   │ │ Email Worker │ │ SMS Worker   │
│ Healthy      │ │ Healthy      │ │ Warning      │ │ Disabled     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Health Details                                                                │
│------------------------------------------------------------------------------│
│ Service | Status | Latency | Last Check | Error | Actions                    │
│------------------------------------------------------------------------------│
│ API /health | Healthy | 40ms | 1 min ago | - | View Logs                    │
│ Database | Healthy | 12ms | 1 min ago | - | View Connections               │
│ Object Storage | Warning | 200ms | 1 min ago | High usage | View Storage     │
│ Email Worker | Warning | - | 3 min ago | Retry failures | View Jobs          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Health data must be from real readiness/health checks.
- Do not expose secrets in logs.
- Disabled integrations should show disabled, not failed.

---

## 13. Queues and Jobs Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Queues & Jobs                                                                │
│ Monitor background jobs, failed jobs, retries and scheduled tasks.            │
│                                                  [Retry Failed] [Clear Done]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Pending Jobs │ │ Failed Jobs  │ │ Completed    │ │ Retry Rate   │
│ 42           │ │ 12           │ │ 18,450       │ │ 4.5%         │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Queue ▼ | Status ▼ | Tenant ▼ | Job Type ▼ | Date Range ▼                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Jobs Table                                                                    │
│------------------------------------------------------------------------------│
│ Job ID | Queue | Tenant | Type | Status | Attempts | Created | Actions       │
│------------------------------------------------------------------------------│
│ job_001 | pdf | Holyland | ReportCardPDF | Failed | 3 | Today | Retry | View │
│ job_002 | email | ABC | NoticeDelivery | Pending | 0 | Today | Cancel | View │
│ job_003 | export | Butwal | iEMISExport | Done | 1 | Yesterday | View        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Job Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ Job Detail                                   │
├──────────────────────────────────────────────┤
│ Job ID: job_001                              │
│ Queue: pdf                                   │
│ Type: ReportCardPDF                          │
│ Tenant: Holyland Kids' Academy               │
│ Status: Failed                               │
│ Attempts: 3                                  │
│                                              │
│ Error Message                                │
│ PDF generation timeout                       │
│                                              │
│ Payload Summary                              │
│ Class: 5A                                    │
│ Exam: Final Term                             │
│                                              │
│ [Retry Job] [Cancel Job] [View Logs]         │
└──────────────────────────────────────────────┘
```

Rules:

- Retry/cancel must require permission.
- Financial jobs require extra care and idempotency.
- Job payload details must be sanitized.

---

## 14. Storage Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Storage                                                                      │
│ Monitor object storage usage, buckets, file growth and tenant limits.         │
│                                                        [Run Cleanup Scan]     │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total Storage│ │ Used Storage │ │ Orphaned     │ │ High Usage   │
│ 5 TB         │ │ 1.8 TB       │ │ 24 GB        │ │ 7 Tenants    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Tenant Storage Table                                                          │
│------------------------------------------------------------------------------│
│ Tenant | Used | Limit | Usage % | Largest Module | Orphaned | Actions        │
│------------------------------------------------------------------------------│
│ Holyland | 2GB | 20GB | 10% | Activity Media | 300MB | View                 │
│ ABC | 700MB | 5GB | 14% | Documents | 50MB | View                          │
│ Butwal | 18GB | 20GB | 90% | Media | 2GB | Upgrade | Cleanup               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- Cleanup actions must show impact preview.
- Storage usage should be grouped by tenant and module.
- Orphaned files should not be hard-deleted without retention policy and audit.

---

## 15. Backups Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Backups                                                                      │
│ Monitor backup status, restore points, tenant exports and recovery readiness. │
│                                                   [Run Backup] [Test Restore]│
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Last Backup  │ │ Backup Health│ │ Restore Tests│ │ Failed Backups│
│ Today 2 AM   │ │ Healthy      │ │ 98% Passed   │ │ 1             │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Backup Table                                                                  │
│------------------------------------------------------------------------------│
│ Tenant | Backup Type | Started | Completed | Status | Size | Actions         │
│------------------------------------------------------------------------------│
│ Holyland | Daily DB | Today 2:00 | Today 2:08 | Success | 1.2GB | View       │
│ ABC | Daily DB | Today 2:10 | Today 2:12 | Success | 300MB | View           │
│ Butwal | Daily DB | Today 2:15 | - | Failed | - | Retry | View Error        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Restore Point Drawer

```text
┌──────────────────────────────────────────────┐
│ Restore Point Detail                         │
├──────────────────────────────────────────────┤
│ Tenant: Holyland Kids' Academy               │
│ Backup Type: Daily DB                        │
│ Status: Success                              │
│ Size: 1.2GB                                  │
│ Created: Today 2:00 AM                       │
│                                              │
│ Restore Options                              │
│ [ ] Restore to sandbox                       │
│ [ ] Restore selected module                  │
│ [ ] Full tenant restore                      │
│                                              │
│ [Test Restore] [Download Metadata]           │
└──────────────────────────────────────────────┘
```

Rules:

- Restore is one of the highest-risk platform workflows.
- Production restore requires approval, reason, impact preview, and audit.
- Test restore should be prioritized before any real restore.

---

## 16. Support Tools Wireframe

Support tools should be very restricted and fully audited.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Support Tools                                                                │
│ Diagnose tenant issues, view tenant health and perform audited support tasks. │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search tenant, user, invoice, student ID, job ID...                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Tenant Diagnostics                    │ │ Support Actions                     │
│--------------------------------------│ │-------------------------------------│
│ Tenant: Holyland Kids' Academy        │ │ [View Tenant Health]                 │
│ API Status: Healthy                   │ │ [View Recent Errors]                 │
│ DB Status: Healthy                    │ │ [Retry Failed Jobs]                  │
│ Storage: OK                           │ │ [Open Audit Logs]                    │
│ Queue: 2 failed jobs                  │ │ [Reset User Session]                 │
│ Billing: Active                       │ │ [Impersonate with Approval]          │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

### Support Action Confirmation

```text
┌──────────────────────────────────────────────┐
│ Sensitive Support Action                     │
├──────────────────────────────────────────────┤
│ Action: Impersonate Tenant Admin             │
│ Tenant: Holyland Kids' Academy               │
│ Reason Required:                             │
│ [ Investigating reported fee receipt issue ] │
│                                              │
│ Approval Required: Yes                       │
│ Session Limit: 15 minutes                    │
│ Audit Recording: Enabled                     │
│                                              │
│ [Cancel] [Request Approval]                  │
└──────────────────────────────────────────────┘
```

Rules:

- Support override/impersonation must be time-limited and audited.
- Tenant diagnostics should avoid exposing private student data unless needed.
- Support actions should prefer diagnostics and recovery over direct data edits.

---

## 17. Global Platform Settings Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Global Platform Settings                                                     │
│ Configure global platform behavior, environments, defaults and safety rules.  │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────────────────────────────────────┐
│ Settings Menu          │ Settings Content                                      │
│-----------------------│------------------------------------------------------│
│ Environment            │ Production / Staging controls                        │
│ Default Tenant Rules   │ Default academic year, default modules               │
│ Security               │ Admin 2FA, session timeout, IP restrictions          │
│ File Rules             │ Max upload size, allowed types, retention            │
│ Billing Rules          │ Trial length, grace period, invoice sequence         │
│ Notifications          │ Platform alert rules                                 │
│ Maintenance Mode       │ Enable/disable maintenance mode                      │
│ Developer Settings     │ API version, debug flags, internal tools             │
└───────────────────────┴──────────────────────────────────────────────────────┘
```

Rules:

- Maintenance mode requires impact preview.
- Debug flags must never be exposed to normal school users.
- Global defaults must not overwrite existing tenant customizations silently.

---

## 18. Platform Route Structure

Recommended web routes:

```text
/platform
/platform/tenants
/platform/tenants/new
/platform/tenants/:tenantId
/platform/plans
/platform/billing
/platform/module-access
/platform/feature-flags
/platform/admins
/platform/rbac-templates
/platform/file-registry
/platform/audit-logs
/platform/system-health
/platform/queues
/platform/storage
/platform/backups
/platform/support
/platform/settings
```

Route rules:

- Protect all platform routes with platform-only guards.
- Do not expose `/platform` to normal school users.
- Do not use school-admin role checks for platform-admin decisions.

---

## 19. Platform Components Plan

Recommended folder:

```text
apps/web/components/platform/
```

### Core Platform Layout Components

```text
platform-shell.tsx
platform-top-bar.tsx
platform-aside.tsx
platform-page-header.tsx
platform-section-card.tsx
platform-kpi-card.tsx
platform-status-badge.tsx
platform-action-menu.tsx
```

### Platform Dashboard Components

```text
platform-dashboard-workspace.tsx
platform-dashboard-kpi-grid.tsx
tenant-activity-panel.tsx
platform-alert-panel.tsx
system-health-summary.tsx
recent-platform-activity.tsx
```

### Tenant Components

```text
tenant-workspace.tsx
tenant-filter-bar.tsx
tenant-table.tsx
tenant-table-row.tsx
tenant-detail-drawer.tsx
tenant-create-wizard.tsx
tenant-school-details-step.tsx
tenant-domain-region-step.tsx
tenant-plan-selection-step.tsx
tenant-module-access-step.tsx
tenant-admin-user-step.tsx
tenant-review-create-step.tsx
tenant-status-badge.tsx
tenant-usage-card.tsx
tenant-health-panel.tsx
tenant-suspend-dialog.tsx
```

### Plans and Billing Components

```text
plans-billing-workspace.tsx
plan-card-grid.tsx
plan-card.tsx
plan-editor-drawer.tsx
plan-module-limit-editor.tsx
billing-table.tsx
billing-status-badge.tsx
tenant-invoice-drawer.tsx
billing-reminder-dialog.tsx
```

### Module Access Components

```text
module-access-workspace.tsx
tenant-module-selector.tsx
module-access-matrix.tsx
module-access-row.tsx
module-lock-reason-field.tsx
apply-plan-defaults-dialog.tsx
tenant-impact-preview.tsx
```

### Feature Flag Components

```text
feature-flags-workspace.tsx
feature-flag-filter-bar.tsx
feature-flag-table.tsx
feature-flag-detail-drawer.tsx
feature-flag-form-dialog.tsx
feature-flag-targeting-panel.tsx
rollout-percentage-control.tsx
tenant-targeting-selector.tsx
feature-flag-audit-panel.tsx
```

### Platform Admin Components

```text
platform-admins-workspace.tsx
platform-admin-filter-bar.tsx
platform-admin-table.tsx
platform-admin-detail-drawer.tsx
invite-platform-admin-dialog.tsx
platform-role-selector.tsx
admin-session-panel.tsx
admin-disable-dialog.tsx
```

### RBAC Template Components

```text
rbac-template-workspace.tsx
role-template-list.tsx
permission-template-matrix.tsx
permission-template-cell.tsx
role-template-editor.tsx
apply-template-dialog.tsx
tenant-permission-override-panel.tsx
```

### File Registry Components

```text
platform-file-registry-workspace.tsx
file-registry-filter-bar.tsx
platform-file-table.tsx
platform-file-detail-drawer.tsx
file-access-log-panel.tsx
orphaned-file-panel.tsx
storage-path-viewer.tsx
protected-platform-file-button.tsx
```

### Audit Log Components

```text
platform-audit-workspace.tsx
audit-filter-bar.tsx
audit-log-table.tsx
audit-severity-badge.tsx
audit-detail-drawer.tsx
audit-before-after-view.tsx
audit-export-button.tsx
```

### System Health Components

```text
system-health-workspace.tsx
health-kpi-grid.tsx
health-status-card.tsx
health-service-table.tsx
health-detail-drawer.tsx
service-log-panel.tsx
health-refresh-button.tsx
```

### Queues and Jobs Components

```text
queue-workspace.tsx
queue-kpi-grid.tsx
queue-filter-bar.tsx
queue-job-table.tsx
queue-status-badge.tsx
queue-job-detail-drawer.tsx
retry-job-dialog.tsx
cancel-job-dialog.tsx
queue-log-panel.tsx
```

### Storage Components

```text
storage-workspace.tsx
storage-kpi-grid.tsx
tenant-storage-table.tsx
storage-usage-bar.tsx
storage-detail-drawer.tsx
orphaned-storage-panel.tsx
cleanup-scan-dialog.tsx
storage-limit-editor.tsx
```

### Backup Components

```text
backup-workspace.tsx
backup-kpi-grid.tsx
backup-table.tsx
backup-status-badge.tsx
backup-detail-drawer.tsx
restore-point-drawer.tsx
run-backup-dialog.tsx
test-restore-dialog.tsx
backup-log-panel.tsx
```

### Support Tool Components

```text
support-tools-workspace.tsx
support-search-bar.tsx
tenant-diagnostics-panel.tsx
support-action-panel.tsx
support-sensitive-action-dialog.tsx
support-approval-request-dialog.tsx
support-session-log-panel.tsx
tenant-error-summary.tsx
```

### Global Platform Settings Components

```text
global-platform-settings-workspace.tsx
platform-settings-sidebar.tsx
environment-settings-panel.tsx
default-tenant-rules-panel.tsx
platform-security-settings-panel.tsx
platform-file-rules-panel.tsx
platform-billing-rules-panel.tsx
platform-notification-rules-panel.tsx
maintenance-mode-panel.tsx
developer-settings-panel.tsx
```

---

## 20. Shared Components Used by Platform

Platform should reuse existing UI components:

```text
ModuleHeader
KpiCard
KpiGrid
DataTable
FilterBar
StatusBadge
ActionMenu
DetailDrawer
ConfirmDialog
EmptyState
ErrorState
LoadingState
AuditTimeline
ProtectedFileButton
ProtectedFileLink
ExportButton
```

Platform may need stricter variants:

```text
SensitiveActionDialog
ReasonRequiredDialog
ApprovalRequiredBanner
EnvironmentBadge
TenantStatusBadge
HealthStatusBadge
SeverityBadge
UsageLimitBar
```

---

## 21. Platform Component Tree

```text
PlatformShell
  PlatformTopBar
  PlatformAside

  PlatformMain
    PlatformDashboardWorkspace
      PlatformDashboardKpiGrid
      TenantActivityPanel
      PlatformAlertPanel
      SystemHealthSummary
      RecentPlatformActivity

    TenantWorkspace
      TenantFilterBar
      TenantTable
      TenantDetailDrawer
      TenantCreateWizard

    PlansBillingWorkspace
      PlanCardGrid
      BillingTable
      PlanEditorDrawer

    ModuleAccessWorkspace
      TenantModuleSelector
      ModuleAccessMatrix

    FeatureFlagsWorkspace
      FeatureFlagTable
      FeatureFlagDetailDrawer

    SystemHealthWorkspace
      HealthKpiGrid
      HealthServiceTable

    QueueWorkspace
      QueueKpiGrid
      QueueJobTable
      QueueJobDetailDrawer

    StorageWorkspace
      StorageKpiGrid
      TenantStorageTable

    BackupWorkspace
      BackupTable
      RestorePointDrawer

    SupportToolsWorkspace
      SupportSearchBar
      TenantDiagnosticsPanel
      SupportActionPanel
```

---

## 22. Implementation Priority for Platform

### P0 — Must Build First

```text
PlatformShell
PlatformDashboardWorkspace
TenantWorkspace
TenantCreateWizard
TenantDetailDrawer
ModuleAccessWorkspace
SystemHealthWorkspace
AuditLogWorkspace
```

### P1 — Important After Tenant Foundation

```text
PlansBillingWorkspace
FeatureFlagsWorkspace
PlatformAdminsWorkspace
RBAC Templates
FileRegistryWorkspace
QueueWorkspace
StorageWorkspace
```

### P2 — Advanced Admin Tools

```text
BackupsWorkspace
SupportToolsWorkspace
GlobalPlatformSettings
MaintenanceModePanel
DeveloperSettingsPanel
```

---

## 23. Best Platform Design Rule

Use this rule for Platform Core:

```text
Every dangerous platform action must require:
1. Reason
2. Confirmation
3. Audit log
4. Role permission
5. Clear impact preview
```

Examples:

```text
Suspend tenant
Delete admin
Disable module
Retry failed payment jobs
Restore backup
Impersonate tenant user
Force logout users
Enable maintenance mode
```

---

## 24. Final Platform Structure

```text
Platform Core
  Dashboard
  Tenants
  Plans & Billing
  Module Access
  Feature Flags
  Platform Admins
  RBAC Templates
  File Registry
  Audit Logs
  System Health
  Queues & Jobs
  Storage
  Backups
  Support Tools
  Global Settings
```

This gives SchoolOS a proper enterprise SaaS control center where platform operators can safely manage multiple schools, monitor system health, control modules, protect tenant data, and support schools without breaking tenant isolation.
