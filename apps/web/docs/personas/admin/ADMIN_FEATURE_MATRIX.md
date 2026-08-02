# SchoolOS Admin Feature and Route Matrix

**Purpose:** Define the complete school-side capability inventory for the School Admin persona and distinguish current repository availability from the target full-Admin model.

---

## 1. Status Legend

| Status | Meaning |
|---|---|
| Current | Existing route and current Admin permission normally allow access. |
| Current partial | Existing route exists, but capability, data, or composition is incomplete for Admin. |
| Hidden by preset | Existing route exists but the current Admin permission preset excludes it. |
| Entitlement-gated | Existing or target capability is shown only when the school's module entitlement is enabled. |
| Proposed | New Admin-specific composition or route is required. |
| Platform-only | Must never be available to a school Admin. |

---

## 2. Global Admin Capability Boundary

| Capability family | Target Admin | Current state | Notes |
|---|---:|---|---|
| Tenant-scoped school operations | Full | Current partial | Most operational modules exist. |
| School settings | Full | Current | Finance/accounting settings are excluded by the Admin preset. |
| Users and roles | Full | Current | High-risk changes need stronger step-up and audit UX. |
| Fees and collections | Full | Hidden by preset | Existing M3 workspaces should be included. |
| Payroll | Full | Hidden by preset | Existing M7 payroll workspaces should be included. |
| Accounting | Full | Hidden by preset | Existing M11 workspaces should be included. |
| Enabled Library/Transport/Canteen/Learning | Full | Entitlement-gated | Full authority only inside enabled modules. |
| Protected exports | Full, audited | Current partial | Catalogue is permission-filtered; finance reports are omitted today. |
| Tenant audit | Full | Current partial | Evidence is fragmented across settings, accounting, and module pages. |
| Other tenants | None | Denied | Platform boundary. |
| SaaS plans and subscriptions | None | Platform-only | Admin may view school entitlement status only. |
| Provider secrets and API keys | None | Platform-only | Admin sees safe connection status only. |
| Support override issuance | None | Platform-only | An Admin cannot elevate into another tenant. |
| Global queues and infrastructure | None | Platform-only | School-side job status remains visible where relevant. |

---

## 3. Command Centre

### 3.1 Dashboard

| Feature | Current route | Current state | Target behavior |
|---|---|---|---|
| School-day summary | `/dashboard` | Current | Show branch, academic year, school day, and last refresh. |
| Attention queue | `/dashboard#needs-attention` | Current | Drill into universal Action Centre filters. |
| Daily operations | `/dashboard` | Current partial | Cover all enabled modules, not only six projected modules. |
| Readiness panels | `/dashboard` | Current | Add security, settings, finance, and enabled-module readiness. |
| Recent activity | `/dashboard` | Current | Show audited school changes and important module events. |
| Approval count | — | Proposed | Cross-module pending approvals with urgency and SLA. |
| Module health matrix | — | Proposed | One row per enabled module with status and next action. |
| Branch comparison | — | Proposed | Consolidated or selected-branch summary. |

### 3.2 Action Centre

| Feature | Current route | Current state | Target behavior |
|---|---|---|---|
| Parent and school service requests | `/dashboard/service-requests` | Current | Keep queue and detail workflow. |
| Payment disputes | `/dashboard/service-requests` | Current | Link to invoice, ledger, receipt, and accounting evidence. |
| Attendance corrections | `/dashboard/attendance/corrections` | Current | Surface as typed Action Centre items. |
| Failed jobs and exports | Multiple | Current partial | Aggregate safe tenant-side failures. |
| Communication delivery failures | Notice routes | Current partial | Include in Action Centre with retry capability. |
| Data-quality exceptions | Multiple | Current partial | Student, finance, payroll, and module exceptions. |
| Assignment and ownership | Service request detail | Current | Standardize across all action item types. |
| SLA and escalation | Service request detail | Current partial | Add priority, due time, overdue, assignee, and escalation. |

### 3.3 Approval Centre

| Feature | Existing source | Current state | Target behavior |
|---|---|---|---|
| Notice approval | `/dashboard/notices/approvals` | Current | Include in universal approval queue. |
| Refund and reversal | `/dashboard/fees/adjustments` | Hidden by preset | Include impact and original transaction. |
| Waiver and discount | M3 adjustment routes | Hidden by preset | Approval threshold and policy evidence. |
| Attendance reopen/correction | M2 routes | Current | Show original and requested values. |
| Leave approval | `/dashboard/hr/leave` | Current | Include staffing impact. |
| Payroll review/post | `/dashboard/payroll/*` | Hidden by preset | Show totals, checks, and accounting effect. |
| Result publish/withdraw | M4 routes | Current | Show readiness and audience impact. |
| Marks unlock | `/dashboard/academics/locks` | Current | Show class, subject, owner, and reason. |
| Fiscal reopen/close | M11 routes | Hidden by preset | High-risk, step-up, and immutable receipt. |
| Activity moderation | `/dashboard/activity/moderation` | Current | Include consent and media evidence. |
| User/role sensitive changes | Settings routes | Current partial | Optional dual approval by school policy. |

### 3.4 School Readiness

| Readiness domain | Current state | Target |
|---|---|---|
| Admissions and student data | Current partial | Capacity, missing documents, duplicates, iEMIS readiness. |
| Attendance | Current | Submission completion, conflicts, repeated absence. |
| Fees | Hidden by preset | Billing, collection, close, provider, aging, posting readiness. |
| Academics | Current partial | Exam setup, marks completion, result and report-card readiness. |
| HR and payroll | Current partial | Staffing, leave, contracts, payroll readiness. |
| Accounting | Hidden by preset | Fiscal period, reconciliation, posting, report readiness. |
| Communication | Current partial | Critical delivery, provider, acknowledgement, failures. |
| Library/Transport/Canteen/Learning | Entitlement-gated | Module-specific readiness only when enabled. |
| Users and security | Current partial | Inactive owners, risky grants, temporary passwords, sessions. |
| Integrations and exports | Current partial | Safe connection status and failed tenant jobs. |

---

## 4. M1 — Admissions and Student Profiles

### 4.1 Admissions Overview

| Feature | Route | State |
|---|---|---|
| Admission queues | `/dashboard/admissions` | Current |
| New admission | `/dashboard/admissions/new` | Current |
| Online applications | `/dashboard/admissions/applications` | Current |
| Assessment and interview | `/dashboard/admissions/assessments` | Current |
| Document issues | `/dashboard/admissions/documents` | Current |
| Duplicate review | `/dashboard/admissions/duplicates` | Current |
| iEMIS readiness | `/dashboard/admissions/iemis` | Current |
| QR and ID cards | `/dashboard/admissions/qr` | Current |
| Admission policy | `/dashboard/settings/admissions` | Current |
| Capacity and waitlist | Admission queues | Current partial |

### 4.2 Student Directory and Profile

| Feature | Route | State |
|---|---|---|
| Student directory | `/dashboard/students` | Current |
| Search and server filters | `/dashboard/students` | Current |
| Student module summary | `/dashboard/students` | Current |
| Protected student documents | Student profile/detail routes | Current |
| Enrollment history | Student profile routes | Current |
| Guardian relationships | Student profile/settings routes | Current partial |
| Medical and safety fields | Student profile routes | Current partial |
| Lifecycle actions | Student profile routes | Current partial |
| Directory and iEMIS exports | `/dashboard/students` | Current |
| Bulk import | Admissions/iEMIS routes | Current partial |

### 4.3 Target Admin-only lifecycle controls

- guardian link verification, suspension, revocation, and recovery;
- temporary guardian access;
- transfer, withdrawal, graduation, and re-enrollment;
- merge and duplicate resolution;
- enrollment placement and roll assignment;
- sensitive-field reveal with reason;
- student data-quality exceptions;
- protected document verification and expiry;
- branch transfer and historical audit.

---

## 5. M2 — Smart Attendance

| Workspace | Route | Current state | Target Admin responsibility |
|---|---|---|---|
| Overview | `/dashboard/attendance` | Current | Completion, absent/late, pending corrections, anomalies. |
| Mark attendance | `/dashboard/attendance/mark` | Current | Full school override capability with reason; delegate normal marking. |
| Register | `/dashboard/attendance/register` | Current | School-wide class register. |
| Monthly register | `/dashboard/attendance/register/monthly` | Current | BS month/year register and export. |
| Corrections | `/dashboard/attendance/corrections` | Current | Review, approve, reject, and audit. |
| Conflicts | Attendance overview/detail routes | Current | Resolve sync and duplicate conflicts. |
| Anomalies | `/dashboard/attendance/anomalies` | Current | Repeated absence, lateness, unusual patterns. |
| Follow-up queue | `/dashboard/attendance/follow-ups` | Current | Assign school follow-up and evidence. |
| Offline drafts | `/dashboard/attendance/offline-drafts` | Current | Diagnose drafts; never expose another device's private cache. |
| Reports | `/dashboard/attendance/reports` | Current | School/branch/class/student reports. |
| Policy | `/dashboard/settings/policies/attendance` | Current | Sessions, locks, corrections, thresholds, visibility. |

---

## 6. M3 — Fees and Receipts

**Current Admin result:** hidden because the Admin preset excludes M3 permission families.

| Workspace | Route | Existing implementation | Target Admin |
|---|---|---:|---:|
| Fees overview | `/dashboard/fees` | Yes | Full |
| Collect payment | `/dashboard/fees/collect` | Yes | Full |
| Billing runs | `/dashboard/fees/billing` | Yes | Full |
| Invoice register | `/dashboard/fees/invoices` | Yes | Full |
| Student ledgers | `/dashboard/fees/ledgers` | Yes | Full |
| Receipt center | `/dashboard/fees/receipts` | Yes | Full |
| Refunds and reversals | `/dashboard/fees/adjustments?view=refunds` | Yes | Full, high-risk |
| Waivers and discounts | `/dashboard/fees/adjustments?view=waivers` | Yes | Full, threshold-aware |
| Cashier close | `/dashboard/fees/cashier-close` | Yes | Full |
| Fees reports | `/dashboard/fees/reports` | Yes | Full |
| Fee heads and plans | `/dashboard/fees/setup?view=structure` | Yes | Full |
| Discount rules | `/dashboard/fees/setup?view=discounts` | Yes | Full |
| Defaulter and aging | Fees reports/overview | Yes/partial | Full |
| Provider status | Fees overview/settings | Partial | Safe school-side status only |
| M3-to-M11 posting | Accounting routes | Yes | Full |

---

## 7. M4 — Academics, Exams, CAS, and Report Cards

| Workspace | Route family | State | Target Admin |
|---|---|---|---|
| Academics overview | `/dashboard/academics` | Current | Full |
| Academic structure | Settings and academics routes | Current | Full |
| Teacher assignments | Academic structure routes | Current partial | Full |
| Exam terms | `/dashboard/academics/exam-terms` | Current | Full |
| Assessment components | `/dashboard/academics/assessment-components` | Current | Full |
| Marks | `/dashboard/academics/marks` | Current | Full |
| CAS | `/dashboard/academics/cas` | Current | Full |
| Marks locks | `/dashboard/academics/locks` | Current | Full, high-risk |
| Retakes | `/dashboard/academics/retakes` | Current | Full |
| Results | `/dashboard/academics/results` | Current | Full |
| Report cards | `/dashboard/academics/report-cards` | Current | Full |
| Promotion | `/dashboard/academics/promotion` | Current | Full |
| Publishing and withdrawal | Result routes | Current | Full, high-risk |
| Reports and exports | Academics/reports | Current partial | Full |
| Exam/report-card policy | `/dashboard/settings/policies/exams` | Current | Full |

---

## 8. M5 — Activity Feed and Milestones

| Workspace | Route | State | Target Admin |
|---|---|---|---|
| Feed | `/dashboard/activity` | Current | Full school-wide |
| Create | `/dashboard/activity/new` | Current | Full |
| Detail and history | `/dashboard/activity/[id]` | Current | Full |
| Moderation | `/dashboard/activity/moderation` | Current | Full |
| Gallery | `/dashboard/activity/gallery` | Current | Full |
| Observations | `/dashboard/activity/observations` | Current | Full |
| Milestones | `/dashboard/activity/milestones` | Current | Full |
| Deliveries | `/dashboard/activity/deliveries` | Current | Full |
| Reports | `/dashboard/activity/reports` | Current | Full |
| Consent policy | `/dashboard/settings/policies/activity-consent` | Current | Full |
| Retention and archive | Module/settings routes | Current partial | Full |

---

## 9. M6 — Homework and Timetable

### Homework

| Workspace | Route | State | Target Admin |
|---|---|---|---|
| Today | `/dashboard/homework?tab=today` | Current | Full school-wide |
| All homework | `/dashboard/homework?tab=all` | Current | Full |
| Completion | `/dashboard/homework?tab=completion` | Current | Full |
| Templates | `/dashboard/homework?tab=templates` | Current | Full |
| Create/edit | Homework detail routes | Current | Full |
| Submission review | Homework detail routes | Current | Full |
| Policy | `/dashboard/settings/policies/homework` | Current | Full |

### Timetable

| Workspace | Route | State | Target Admin |
|---|---|---|---|
| Weekly grid | `/dashboard/timetable` | Current | Full |
| Versions | `/dashboard/timetable` tab | Current | Full |
| Requirements | `/dashboard/timetable` tab | Current | Full |
| Builder | `/dashboard/timetable/builder` | Current | Full |
| Conflicts | `/dashboard/timetable/conflicts` | Current | Full |
| Substitutions | `/dashboard/timetable/substitutions` | Current | Full |
| Replacements | `/dashboard/timetable/replacements` | Current | Full |
| Publication and lock | Timetable version routes | Current partial | Full, high-risk |

---

## 10. M7 — HR and Payroll

### HR

| Workspace | Route | Current Admin | Target Admin |
|---|---|---|---|
| HR dashboard | `/dashboard/hr` | Current | Full |
| Staff | `/dashboard/hr/staff` | Current | Full |
| Staff profile | `/dashboard/hr/staff/[id]` | Current | Full |
| Contracts | `/dashboard/hr/contracts` | Current | Full |
| Staff attendance | `/dashboard/hr/attendance` | Current | Full |
| Leave | `/dashboard/hr/leave` | Current | Full |
| Onboarding/offboarding | Staff routes | Current partial | Full |
| Qualifications/documents | Staff routes | Current partial | Full |
| HR settings | `/dashboard/settings/hr-payroll` | Hidden/partial | Full |

### Payroll

| Workspace | Route | Current Admin | Target Admin |
|---|---|---|---|
| Payroll overview | `/dashboard/payroll` | Hidden by preset | Full |
| Runs | `/dashboard/payroll/runs` | Hidden by preset | Full |
| Readiness | `/dashboard/payroll/readiness` | Hidden by preset | Full |
| Payslips | `/dashboard/payroll/payslips` | Hidden by preset | Full |
| Reports | `/dashboard/payroll/reports` | Hidden by preset | Full |
| Approval | Payroll run routes | Hidden by preset | Full, high-risk |
| Posting handoff | `/dashboard/accounting/payroll-handoff` | Hidden by preset | Full |
| Reversal/correction | Payroll run routes | Hidden by preset | Full, high-risk |

---

## 11. M8 — Library

**Visibility:** entitlement-gated.

| Workspace | Route | State |
|---|---|---|
| Overview | `/dashboard/library` | Current when enabled |
| Catalog | `/dashboard/library/catalog` | Current when enabled |
| Copies/accessions | Library subroutes | Current partial |
| Issues and returns | `/dashboard/library/issues` | Current when enabled |
| Overdue | `/dashboard/library/overdue` | Current when enabled |
| Fines | `/dashboard/library/fines` | Current when enabled |
| Borrowers | `/dashboard/library/borrowers` | Current when enabled |
| Reservations | Library subroutes | Current partial |
| Lost/damaged | Library subroutes | Current partial |
| Reports | Library report routes | Current when enabled |
| Settings | Library workspace/settings hub | Current when enabled |
| Finance handoff | M3/M11 routes | Current partial |

Target Admin receives full module authority when enabled.

---

## 12. M9 — Transport

**Visibility:** entitlement-gated.

| Capability | Existing route family | State |
|---|---|---|
| Overview | `/dashboard/transport` | Current when enabled |
| Trips | `/dashboard/transport/trips` | Current when enabled |
| Student assignments | `/dashboard/transport/students` | Current when enabled |
| Routes and stops | Transport routes | Current partial |
| Vehicles | Transport routes | Current partial |
| Drivers/conductors | Transport/HR routes | Current partial |
| Boarding/deboarding | Trip routes | Current partial |
| Live status | Transport live-status routes | Current partial |
| Stale GPS | Reports/operations routes | Current |
| Incidents | Transport routes | Current partial |
| Documents/maintenance | Transport routes | Current partial |
| Reports | Transport report routes | Current |
| Settings | Transport workspace/settings hub | Current |
| Fee and accounting handoff | M3/M11 routes | Current partial |

Target Admin receives full module authority when enabled, but no GPS provider credentials.

---

## 13. M10 — Canteen

**Visibility:** entitlement-gated.

| Capability | Existing route family | State |
|---|---|---|
| Overview | `/dashboard/canteen` | Current when enabled |
| POS | `/dashboard/canteen/pos` | Current when enabled |
| Serving | `/dashboard/canteen/serving` | Current when enabled |
| Enrollments | `/dashboard/canteen/enrollments` | Current when enabled |
| Menu | Canteen routes | Current partial |
| Meal plans | Canteen routes | Current partial |
| Wallets | Canteen routes | Current partial |
| Refunds/reversals | Canteen routes | Current partial |
| Vendors/procurement | Canteen routes | Current partial |
| Stock/wastage | Canteen routes | Current partial |
| Allergy policy | Canteen/settings routes | Current partial |
| Settlement/reports | Canteen reports | Current |
| Finance handoff | M11 routes | Current partial |

Target Admin receives full module authority when enabled.

---

## 14. M11 — Accounting and Finance

**Current Admin result:** hidden because the Admin preset excludes accounting and finance permission families.

| Workspace | Route | Existing | Target Admin |
|---|---|---:|---:|
| Finance dashboard | `/dashboard/accounting` | Yes | Full |
| Receivables | `/dashboard/accounting/receivables` | Yes | Full |
| Collections and receipts | `/dashboard/accounting/collections` | Yes | Full |
| Reconciliation | `/dashboard/accounting/reconciliation` | Yes | Full |
| Journals | `/dashboard/accounting/journals` | Yes | Full |
| Cash and bank | `/dashboard/accounting/cash-bank` | Yes | Full |
| Expenses and payables | `/dashboard/accounting/payables` | Yes | Full |
| Payroll handoff | `/dashboard/accounting/payroll-handoff` | Yes | Full |
| Source mappings | `/dashboard/accounting/source-mappings` | Yes | Full |
| Posting batches | Accounting routes | Yes | Full |
| Chart of accounts | Accounting management routes | Yes | Full |
| Fiscal years/periods | `/dashboard/accounting/fiscal-periods` | Yes | Full |
| Reports | Accounting/report routes | Yes | Full |
| Audit trail | `/dashboard/accounting/audit` | Yes | Full |
| Accounting settings | `/dashboard/settings/accounting` | Yes | Full |
| Fiscal reopen/close | Accounting routes | Yes | Full, highest risk |

---

## 15. M12 — Notifications and Delivery

| Workspace | Route | State | Target Admin |
|---|---|---|---|
| Personal inbox | `/dashboard/notifications` | Current | Full personal access |
| Delivery logs | `/dashboard/notices/deliveries` | Current | Full tenant diagnostics |
| Failure/retry center | `/dashboard/notices/failures` | Current partial | Full, reason required |
| Templates | Notice/settings routes | Current partial | Full school templates |
| Quiet hours/policy | `/dashboard/settings/communication` | Current | Full |
| Safe integration status | `/dashboard/settings/system/integrations` | Current | View status only |
| Provider credentials | `/platform/*` | Platform-only | Never |
| Critical escalation | Communication routes | Current partial | Full school-side policy |
| Acknowledgement reports | Notice/report routes | Current | Full |

---

## 16. M13 — Learning Layer

**Visibility:** entitlement-gated and release-gated.

| Workspace | Route | State |
|---|---|---|
| Overview | `/dashboard/learning` | Current when enabled |
| Activities | `/dashboard/learning/activities` | Current when enabled |
| New activity | `/dashboard/learning/activities/new` | Current when enabled |
| Sessions | `/dashboard/learning/sessions` | Current when enabled |
| Attempts/review | Learning routes | Current when enabled |
| Progress | Learning routes | Current when enabled |
| Resources | Learning routes | Current partial |
| Reports | Learning routes | Current partial |
| Settings/retention | Learning workspace/settings hub | Current partial |

Target Admin receives full school-side authority when enabled. Admin cannot bypass the release or entitlement gate.

---

## 17. M15 — Notices and Announcements

| Workspace | Route | State |
|---|---|---|
| All notices | `/dashboard/notices` | Current |
| New notice | `/dashboard/notices/new` | Current |
| Scheduled | `/dashboard/notices/scheduled` | Current |
| Approvals | `/dashboard/notices/approvals` | Current |
| Delivery logs | `/dashboard/notices/deliveries` | Current |
| Failures/retries | `/dashboard/notices/failures` | Current partial |
| Detail/version history | Notice detail routes | Current |
| Recipient preview | Composer/detail routes | Current |
| Acknowledgement | Notice report routes | Current |
| Correction/withdrawal | Notice detail routes | Current partial |
| Categories and policy | Settings/notice routes | Current partial |

---

## 18. Reports, Exports, and Audit

### Reports and exports

| Feature | Route | Current state | Target |
|---|---|---|---|
| Report catalogue | `/dashboard/reports` | Current partial | All tenant reports visible. |
| Report filters | `/dashboard/reports` | Current | Preserve context in URL. |
| CSV/PDF/JSON | `/dashboard/reports` | Current | Permission and report-definition controlled. |
| Background export | `/dashboard/reports` | Current | Required for large outputs. |
| Export history | `/dashboard/reports` | Current | Include owner, reason, expiry, checksum. |
| Protected download | `/dashboard/reports` | Current | Keep File Registry. |
| Retry failed export | `/dashboard/reports` | Current | Audited. |
| Finance reports | Report/accounting routes | Hidden by preset | Full. |
| Payroll reports | Payroll routes | Hidden by preset | Full. |
| Multi-branch consolidation | Reports | Proposed | Full where supported. |

### School audit

| Audit source | Current route | Target unified index |
|---|---|---|
| Settings changes | `/dashboard/settings/system/audit-log` | Yes |
| Accounting audit | `/dashboard/accounting/audit` | Yes |
| Financial transaction history | M3/M11 detail routes | Yes |
| User and role changes | Settings audit | Yes |
| Student lifecycle | Student/admission history | Yes |
| Attendance correction | M2 detail | Yes |
| Marks/results changes | M4 detail | Yes |
| Payroll changes | M7 detail | Yes |
| Notice lifecycle | M15 detail | Yes |
| Delivery retry | M12 detail | Yes |
| Protected exports | Reports/settings | Yes |
| Support override | Platform audit | Admin may see only an active-override banner and tenant-visible support event, not platform audit internals. |

---

## 19. School Settings Matrix

The backend settings navigation currently defines these Admin destinations.

### School Setup

- Overview — `/dashboard/settings`
- Identity — `/dashboard/settings/school/identity`
- Branding — `/dashboard/settings/school/branding`
- Academic year and calendar — `/dashboard/settings/school/academic-year`
- Classes, sections, and subjects — `/dashboard/settings/school/academic-structure`
- School modules — `/dashboard/settings/school/modules`

### Academic and Student Policy

- Admissions — `/dashboard/settings/admissions`
- Attendance — `/dashboard/settings/policies/attendance`
- Exams and report cards — `/dashboard/settings/policies/exams`
- Homework and timetable — `/dashboard/settings/policies/homework`
- Activity, media, and consent — `/dashboard/settings/policies/activity-consent`

### Finance and Administration

- Fees and receipts — `/dashboard/settings/fees`
- Accounting and fiscal policy — `/dashboard/settings/accounting`
- HR and payroll — `/dashboard/settings/hr-payroll`

The current Admin preset hides finance and accounting administration. The target Admin must receive full access.

### Communication and Documents

- Communication policy — `/dashboard/settings/communication`
- Documents and templates — `/dashboard/settings/documents-templates`
- Safe integration status — `/dashboard/settings/system/integrations`

### People and Governance

- Users — `/dashboard/settings/access/users`
- Roles and permissions — `/dashboard/settings/access/roles`
- Security and access — `/dashboard/settings/security`
- Audit and exports — `/dashboard/settings/system/audit-log`

### Enabled Module Settings

- Library
- Transport
- Canteen
- Learning

These appear only when entitled and permitted.

---

## 20. Platform-Only Matrix

| Platform function | Route family | School Admin result |
|---|---|---|
| Platform dashboard | `/platform/dashboard` | Denied |
| Tenant provisioning | `/platform/tenants/*` | Denied |
| Tenant suspension/status | `/platform/tenants/*` | Denied |
| Plans | `/platform/plans/*` | Denied |
| Subscriptions | `/platform/subscriptions/*` | Denied |
| SaaS billing | `/platform/billing/*` | Denied |
| Usage metering | `/platform/usage/*` | Denied |
| Providers and credentials | `/platform/providers/*` | Denied |
| Platform API keys | `/platform/api-keys/*` | Denied |
| Global queues | `/platform/queues/*` | Denied |
| Support overrides | `/platform/support/*` | Denied |
| Platform audit | `/platform/audit/*` | Denied |
| Platform health | `/platform/health/*` | Denied |
| Platform reports | `/platform/reports/*` | Denied |
| Platform onboarding | `/platform/onboarding/*` | Denied |

The school Admin may see tenant-safe status derived from these systems, but never the control plane or its secrets.

---

## 21. Target Permission Result

The target Admin role should receive:

```text
all permissionCatalog keys
minus platform permission keys
minus tenants:manage
minus removed chat-write keys
minus future developer-only permission families
```

The permission contract should be tested as a set equation, not maintained through a manual denylist of school modules.

---

## 22. Navigation Visibility Rules

A module link appears when all are true:

1. user persona is Admin;
2. tenant is active;
3. module is enabled or is a core module;
4. server session contains the required tenant permission;
5. route is not Platform-owned;
6. the current branch context permits the module where branch scoping applies.

A hidden module and a disabled module are different states:

- **Permission denied:** do not show navigation; direct route gives safe denial.
- **Not enabled:** show only in Settings > Modules or readiness, not as an operational link.
- **Enabled but not configured:** show link with setup-required state.
- **Enabled and unavailable:** show operational link with error/unavailable state.
- **Deferred by release policy:** show no active navigation unless the release gate enables it.

---

## 23. Admin Delegation Principle

Although Admin has full authority, SchoolOS should still support specialist operating roles:

- Cashier
- Accountant
- HR Manager
- Librarian
- Transport Manager/Operator
- Canteen Manager/Operator
- Academic Coordinator
- Examination Coordinator
- Communication Officer

Admin access is the recovery and governance ceiling. Routine work should be delegated to narrower roles, and the Admin UI should make delegation easy without forcing the Admin to surrender full school authority.