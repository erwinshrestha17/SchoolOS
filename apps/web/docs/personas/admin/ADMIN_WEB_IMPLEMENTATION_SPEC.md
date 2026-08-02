# SchoolOS Admin Web Implementation Specification

**Document type:** Implementation and acceptance specification  
**Persona:** School Admin  
**Target:** Full tenant-scoped school authority with zero Platform authority  
**Related documents:**

- `ADMIN_PERSONA_AUDIT.md`
- `ADMIN_FEATURE_MATRIX.md`
- `ADMIN_WEB_DESIGN.md`
- `ADMIN_WEB_WIREFRAMES.md`

---

## 1. Objective

Implement one coherent Admin web persona that can configure and operate every enabled school capability while remaining strictly isolated from SchoolOS Platform operations.

The implementation must reuse existing module workspaces and contracts wherever possible. It must not create duplicate Admin-only versions of Accounting, Payroll, Library, Transport, Canteen, Learning, or other specialist modules merely to expose them to Admin.

### Target equation

```text
Admin authority
= all tenant-scoped school permissions
- all Platform permissions
- cross-tenant capability
- removed chat-write capability
```

---

## 2. Non-Negotiable Boundaries

### School Admin may access

```text
/dashboard/*
/dashboard/settings/*
```

subject to tenant, branch, entitlement, workflow, and record-state constraints.

### School Admin may never access

```text
/platform/*
platform:*
tenants:manage
```

### Platform operator behavior

A Platform role does not become a school Admin merely by entering the school application.

School access for a Platform operator requires:

- an explicit support override;
- a target tenant;
- a reason;
- a time limit;
- a scoped acting persona;
- a visible banner;
- immutable audit evidence.

---

## 3. P0 Authorization Changes

## P0-ADM-01 — Full tenant Admin permission preset

### Affected file

```text
packages/core/src/permissions/roles.ts
```

### Current behavior

```ts
admin: TENANT_PERMISSION_KEYS.filter(
  (key) => !ADMIN_EXCLUDED_FINANCE_KEYS.includes(key),
)
```

### Required behavior

```ts
export const ADMIN_PERMISSION_KEYS: PermissionKey[] = [
  ...TENANT_PERMISSION_KEYS,
];

systemRolePermissions.admin = [...ADMIN_PERMISSION_KEYS];
```

Remove `ADMIN_EXCLUDED_FINANCE_KEYS` from the Admin preset.

### Required invariants

```ts
ADMIN_PERMISSION_KEYS.every((key) => !key.startsWith('platform:'))
ADMIN_PERMISSION_KEYS.includes('tenants:manage') === false
ADMIN_PERMISSION_KEYS.includes('fees:manage') === true
ADMIN_PERMISSION_KEYS.includes('payroll:manage') === true
ADMIN_PERMISSION_KEYS.includes('accounting:read') === true
ADMIN_PERMISSION_KEYS.includes('settings:finance:manage') === true
ADMIN_PERMISSION_KEYS.includes('settings:accounting:manage') === true
```

### Future-proofing

Test the permission set as an equation against the permission catalogue. Do not maintain a manual allowlist of hundreds of school permissions for Admin.

If a new permission family is developer-only, it must be added to the Platform/developer exclusion source before it can reach `TENANT_PERMISSION_KEYS`.

---

## P0-ADM-02 — Config Owner authority model

### Affected file

```text
packages/core/src/permissions/roles.ts
```

### Required model

```text
admin
  all tenant school permissions

school_config_owner
  all admin permissions
  + settings:delegate
  + ownership-transfer or continuity safeguards where implemented
```

Recommended implementation:

```ts
const SCHOOL_CONFIG_OWNER_PERMISSION_KEYS = [
  ...ADMIN_PERMISSION_KEYS,
  'settings:delegate',
];
```

Deduplicate with `Set`.

### Safeguards

- at least one active Config Owner per tenant;
- an Admin cannot remove the last owner;
- ownership transfer requires confirmation and audit;
- Config Owner is not a Platform role;
- Admin remains capable of complete school operation without the owner role.

---

## P0-ADM-03 — Fail-closed persona resolution

### Affected file

```text
packages/core/src/school-web-persona.ts
```

### Current problem

- Platform roles are included in `FULL_ADMIN_ROLES`.
- Unknown non-teacher users default to `admin`.

### Required persona type

```ts
export type SchoolWebPersona =
  | 'teacher'
  | 'principal'
  | 'hr'
  | 'accountant'
  | 'librarian'
  | 'cashier'
  | 'transport_operator'
  | 'canteen_operator'
  | 'admin'
  | 'restricted_school_user';
```

Platform persona resolution should remain outside the school persona type or use a clearly separate `PlatformWebPersona`.

### Required role mapping

```text
admin -> admin
school_config_owner -> admin
platform_* -> not a SchoolWebPersona
unknown / no recognized role -> restricted_school_user
```

### Support override

If a Platform user has an active support override, derive the acting school persona from the override authorization context, not from the user's Platform role.

---

## P0-ADM-04 — Platform route denial

### Affected surfaces

```text
apps/web/app/platform/layout.tsx
apps/web/app/dashboard/layout.tsx
API PlatformGuard / permissions
```

### Required tests

- school Admin navigating to `/platform/dashboard` is redirected or shown a safe restricted page;
- no Platform child component renders before denial;
- Platform APIs return `403` for Admin JWT/session;
- Admin cannot call tenant provisioning, plans, billing, provider, queue, API-key, support, platform-audit, platform-health, or platform-report APIs;
- global search and command palette do not return Platform routes for Admin;
- no Platform role is grantable from School Settings > Roles.

### Restricted copy

```text
Platform access is restricted.
This account administers one school. SchoolOS Platform controls are available
only to authorized SchoolOS operators.
```

---

## P0-ADM-05 — Finance, payroll, and accounting route availability

### Affected files

```text
apps/web/components/layout/sidebar-persona-nav.config.ts
apps/web/app/dashboard/layout.tsx
apps/web/lib/nav-module-map.ts
module API permissions
```

### Required Admin navigation access

- `/dashboard/fees/*`
- `/dashboard/payroll/*`
- `/dashboard/accounting/*`
- `/dashboard/settings/fees`
- `/dashboard/settings/accounting`
- `/dashboard/settings/hr-payroll`
- finance and payroll report definitions

### Rule

Do not duplicate Accountant navigation components. Admin may use the same canonical M3/M7/M11 routes because backend authorization and UI actions are permission-driven.

### Route-gate verification

Every listed route must:

- pass for Admin;
- remain denied for unrelated roles;
- remain entitlement-aware where relevant;
- keep operation-level mutation checks.

---

## P0-ADM-06 — School-only permission editor

### Affected surfaces

```text
/dashboard/settings/access/roles
role catalogue APIs
role mutation APIs
```

### Required behavior

- Platform permission keys are absent from the school role editor payload;
- tenant role APIs reject any `platform:*` key or `tenants:manage` even if manually supplied;
- system Admin and Config Owner permissions cannot be silently reduced below product safeguards;
- risky school permissions are grouped and labeled;
- permission changes show affected users;
- role changes produce audit events.

---

## P0-ADM-07 — High-risk action contract

Create or standardize a shared contract for high-risk actions.

### Required fields

```ts
interface HighRiskActionRequest {
  reason: string;
  expectedVersion?: string;
  idempotencyKey: string;
  confirmationToken?: string;
  approvalRequestId?: string;
}
```

Actual DTOs remain operation-specific, but all high-risk flows must provide equivalent controls.

### Required response evidence

```ts
interface HighRiskActionResult {
  status: 'SUCCEEDED' | 'PENDING_APPROVAL' | 'QUEUED';
  auditEventId: string;
  effectiveAt?: string;
  jobId?: string;
  approvalRequestId?: string;
}
```

### Covered actions

- student transfer, withdrawal, graduation, merge;
- guardian restriction, suspension, recovery;
- attendance lock override and correction;
- refund, reversal, waiver above threshold, cashier reopen;
- result publish/withdraw and marks unlock;
- timetable publish;
- staff termination;
- payroll approve/post/reverse/pay;
- journal post/reverse;
- fiscal close/reopen;
- bank reconciliation finalization/reopen;
- notice publish/withdraw/correct;
- media removal;
- user suspension and risky role change;
- sensitive export.

---

## 4. Target Admin Navigation Implementation

### Affected file

```text
apps/web/components/layout/sidebar-persona-nav.config.ts
```

### Recommended structure

```ts
export const adminNavGroups: NavGroup[] = [
  commandCentreGroup,
  studentsGroup,
  dailyOperationsGroup,
  academicsGroup,
  peopleGroup,
  financeGroup,
  schoolServicesGroup,
  evidenceGroup,
];
```

Settings remains a footer/System item and opens the grouped Settings Control Center.

### Command Centre

```text
/dashboard
/dashboard/service-requests
/dashboard/approvals             proposed
/dashboard/readiness             proposed
```

### Students

```text
/dashboard/admissions
/dashboard/students
/dashboard/guardians             proposed hub
/dashboard/enrollment            proposed hub
```

### Daily Operations

```text
/dashboard/attendance
/dashboard/activity
/dashboard/notices
/dashboard/notifications
```

### Academics

```text
/dashboard/academics
/dashboard/academics/exams or canonical exam route
/dashboard/homework
/dashboard/timetable
/dashboard/learning              entitlement-gated
```

### People

```text
/dashboard/hr
/dashboard/hr/leave
/dashboard/payroll
```

### Finance

```text
/dashboard/fees
/dashboard/accounting
/dashboard/accounting/cash-bank
/dashboard/accounting/payables
```

### School Services

```text
/dashboard/library               entitlement-gated
/dashboard/transport             entitlement-gated
/dashboard/canteen               entitlement-gated
```

### Evidence

```text
/dashboard/reports
/dashboard/audit                 proposed tenant audit index
```

### Navigation constraints

- module entitlement filter remains active;
- Admin should not see duplicated Accountant/HR specialist nav trees;
- local module tabs expose detailed workflows;
- no Platform links;
- no hidden student/financial data in badges;
- badge fetch failure never blocks navigation.

---

## 5. Dashboard Contract

### Current endpoint

```text
GET /dashboard/summary
```

### Required Admin composition

The server must resolve Admin from authenticated context and return a bounded command summary.

### Proposed response extension

```ts
interface AdminDashboardSummary extends OperationalDashboardSummary {
  compositionPersona: 'admin';
  context: {
    tenantId: string;
    branchId?: string;
    academicYearId?: string;
    fiscalYearId?: string;
    schoolDay: string;
  };
  approvals: {
    urgent: number;
    dueToday: number;
    total: number;
  };
  moduleHealth: Array<{
    module: OperationalSummaryModule | string;
    status: 'ready' | 'attention' | 'blocked' | 'unavailable' | 'notConfigured';
    label: string;
    primaryIssue?: string;
    issueCount?: number;
    route?: string;
    updatedAt?: string;
  }>;
  governance: {
    riskyRoleAssignments?: number;
    inactiveOwnerRisk?: boolean;
    temporaryPasswordUsers?: number;
    failedExports?: number;
    integrationIssues?: number;
  };
}
```

### Data minimization

- summary endpoints return counts/status, not full records;
- sensitive salary, medical, guardian, and transaction details remain in protected module endpoints;
- disabled modules are not queried;
- unavailable modules return explicit status;
- dashboard result remains bounded.

### Admin dashboard modules

At minimum include status from:

```text
M1, M2, M3, M4, M5, M6, M7, M11, M12/M15
```

Include M8, M9, M10, and M13 only when enabled.

---

## 6. New Cross-Module Workspaces

## 6.1 Approval Centre

### Route

```text
/dashboard/approvals
```

### Proposed APIs

```text
GET  /approvals?category=&status=&priority=&assignee=&page=&limit=
GET  /approvals/:id
POST /approvals/:id/approve
POST /approvals/:id/return
POST /approvals/:id/reject
```

### Approval summary DTO

```ts
interface SchoolApprovalSummary {
  id: string;
  type: string;
  module: string;
  title: string;
  subjectLabel?: string;
  requestedBy: { id: string; name: string };
  requestedAt: string;
  dueAt?: string;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED';
  amount?: string;
  branchId?: string;
}
```

### Approval detail must include

- original and requested values;
- impact summary;
- policy/threshold;
- evidence attachments;
- requester and previous reviewers;
- separation-of-duties state;
- decision history;
- safe deep link to canonical module record.

### Rule

The Approval Centre orchestrates and links existing module approval contracts. It must not become an untyped generic mutation engine.

---

## 6.2 School Readiness

### Route

```text
/dashboard/readiness
```

### Proposed API

```text
GET /school-readiness?branchId=&academicYearId=&fiscalYearId=
```

### DTO

```ts
interface SchoolReadinessResponse {
  generatedAt: string;
  context: Record<string, string | null>;
  domains: Array<{
    key: string;
    label: string;
    status: 'READY' | 'ATTENTION' | 'BLOCKED' | 'UNAVAILABLE';
    checks: Array<{
      key: string;
      label: string;
      status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';
      count?: number;
      owner?: string;
      route?: string;
      updatedAt?: string;
    }>;
  }>;
}
```

No synthetic overall percentage is required.

---

## 6.3 Guardians and Access hub

### Route

```text
/dashboard/guardians
```

### Proposed APIs

Use existing guardian/student contracts where available; add purpose-limited list endpoints if no bounded Admin guardian directory exists.

Required list fields:

- guardian identity summary;
- linked-student count and safe labels;
- relationship types;
- capability summary;
- verification/status;
- recovery/suspension indicators;
- last sign-in only where policy permits.

Do not return unrestricted custody or medical evidence in list payloads.

---

## 6.4 Enrollment and Lifecycle hub

### Route

```text
/dashboard/enrollment
```

### Required queues

- placement;
- re-enrollment;
- transfers;
- withdrawals;
- graduation;
- capacity exceptions;
- blocked lifecycle actions.

Reuse canonical student/enrollment mutations.

---

## 6.5 School Audit index

### Route

```text
/dashboard/audit
```

### Proposed API

```text
GET /audit/events?from=&to=&actor=&module=&entityType=&action=&risk=&page=&limit=
GET /audit/events/:id
POST /audit/exports
```

### Security

- tenant scope from auth only;
- branch filters may narrow, never broaden;
- sensitive before/after values masked by policy;
- Platform audit events are excluded;
- support-override visibility is limited to tenant-visible support events.

---

## 7. Settings Implementation

### Existing backend navigation

Continue using:

```text
GET /settings/navigation
```

or the current canonical versioned endpoint.

### Admin access result

Admin should receive `manage` access for all tenant settings domains and module-owned settings when entitled.

Config Owner may receive `delegate` where appropriate.

### Required settings groups

- School Setup
- Academic & Student Policy
- Finance & Administration
- Communication & Documents
- People & Governance
- Enabled Module Settings

### Required Platform-safe language

Settings > Modules:

```text
Enabled modules for this school. Subscription and entitlement changes are
managed by SchoolOS Platform.
```

Settings > Integrations:

```text
Connection and delivery status only. Credentials and provider secrets remain
managed by SchoolOS Platform.
```

### Finance settings

After P0-ADM-01, Admin must receive manage access to:

- fees;
- accounting;
- HR/payroll.

---

## 8. Shared Components

Create or standardize these reusable components.

### Command Centre

```text
AdminCommandSummary
AdminActionQueue
AdminApprovalSummary
ModuleHealthMatrix
SchoolReadinessGrid
GovernanceReadinessPanel
```

### High-risk controls

```text
HighRiskActionDialog
ImpactSummary
OriginalRequestedDiff
ReasonField
StepUpRequirement
ApprovalChain
ActionReceipt
```

### Context

```text
SchoolContextBar
BranchSelector
AcademicYearSelector
FiscalPeriodIndicator
SupportOverrideBanner
```

### Data and evidence

```text
ServerFilterBar
ActiveFilterChips
PaginatedDataTable
RecordDetailDrawer
AuditTimeline
ProtectedExportAction
QueuedJobStatus
PartialDataBanner
```

### Rules

- reuse existing shared UI primitives first;
- do not duplicate button, table, drawer, modal, badge, protected-file, toast, loading, empty, or error primitives;
- module-specific components own domain rendering;
- cross-module components only consume defined summary/approval/audit contracts.

---

## 9. Route and Module Mapping

Update `apps/web/lib/nav-module-map.ts` for any new routes.

Recommended mapping:

```text
/dashboard/approvals         -> core / no entitlement, items permission-filtered
/dashboard/readiness         -> core / enabled-module summaries
/dashboard/guardians         -> M1
/dashboard/enrollment        -> M1
/dashboard/audit             -> core tenant audit
```

Existing module routes retain current entitlement mapping.

Direct disabled-module access uses `UpgradePrompt` or module-locked state, not permission denial.

---

## 10. Branch and Context Model

### Global context

Introduce or standardize a context contract:

```ts
interface SchoolOperationContext {
  tenantId: string;      // auth-owned, never client supplied as authority
  branchId?: string;
  academicYearId?: string;
  fiscalYearId?: string;
  schoolDay?: string;
}
```

### Rules

- tenant ID always comes from auth;
- branch ID is validated against user scope;
- academic and fiscal context are route/domain-specific;
- context changes update query keys;
- reports state their context visibly;
- consolidated views clearly label `All branches`;
- mutations require an explicit branch when the record is branch-scoped.

---

## 11. Sensitive Data Handling

Admin has authority, but sensitive values still require responsible UX.

### Mask by default where policy requires

- staff bank details;
- full salary detail in broad lists;
- medical and custody restrictions;
- guardian recovery evidence;
- provider/payment secrets;
- national identifiers;
- protected document contents;
- export file URLs.

### Reveal behavior

```text
[Reveal sensitive value]
-> reason prompt if configured
-> backend authorization
-> short-lived value
-> audit event
-> auto-hide on navigation/timeout
```

### Export behavior

- reason;
- classification;
- watermark;
- queued generation for large files;
- protected File Registry reference;
- expiry;
- generation and download audit.

---

## 12. Operation-Level Permission Checks

Full Admin access does not remove the need for explicit UI capability checks.

Every page must still derive:

```text
canRead
canCreate
canUpdate
canApprove
canPost
canReverse
canExport
canConfigure
```

Why:

- support override may intentionally be narrower;
- future custom Admin-derived roles may be narrower;
- page components are shared with specialist personas;
- backend permissions remain authority;
- action buttons should not invite predictable `403` responses.

Do not infer action capability from persona name alone.

---

## 13. Query and State Requirements

### Query keys

Include relevant scope:

```ts
[
  'resource',
  tenantId,
  branchId,
  academicYearId,
  fiscalYearId,
  filters,
  page,
]
```

Tenant ID may be omitted from the HTTP request when auth-owned, but including it in browser cache partitioning is recommended when a session can switch tenant through an audited support override.

### Mutations

- use idempotency for financial, bulk, generation, and high-risk operations;
- invalidate exact affected summaries and lists;
- preserve unrelated cached work;
- show pending/success/error;
- do not optimistically update official money, marks, attendance, payroll, or accounting totals;
- handle partial success explicitly.

### URL state

Use URL-backed filters for shareable operational queues and reports.

Do not place secrets, sensitive values, or protected file references in URLs.

---

## 14. Required Screen States

Every Admin page must support:

| State | Required behavior |
|---|---|
| Loading | Preserve title/context; matching skeleton. |
| Empty | Explain cause and safe next action. |
| No results | Preserve filters and offer reset. |
| Error | School-friendly message, retry, no raw internal detail. |
| Partial | Identify unavailable domains; preserve valid data. |
| Permission denied | No restricted data; safe return action. |
| Module not enabled | Explain entitlement boundary and open module settings. |
| Not configured | Link to setup; do not show fake operational values. |
| Stale | Timestamp and refresh. |
| Offline locked | Prevent authoritative mutations. |
| Queued job | Backend lifecycle and result history. |
| Partial bulk success | Success/failure counts and downloadable result. |
| Protected file unavailable | Missing/expired/restricted message. |
| Version conflict | Preserve input and require refresh/review. |

---

## 15. Testing Strategy

## 15.1 Core permission tests

Add tests for:

```text
packages/core/src/permissions/roles.spec.ts
```

Assertions:

- Admin equals all tenant permissions;
- Admin contains finance/payroll/accounting keys;
- Admin contains settings finance/accounting keys;
- Admin contains no Platform key;
- Admin contains no `tenants:manage`;
- Config Owner is a superset of Admin plus delegation safeguard;
- no duplicate permission keys.

## 15.2 Persona resolver tests

Update/add:

```text
packages/core/src/school-web-persona.spec.ts
apps/api/src/teacher-scope/school-web-persona.spec.ts
apps/web/test/sidebar-navigation.test.mjs
```

Cases:

- Admin -> admin;
- Config Owner -> admin;
- Principal -> principal;
- Accountant -> accountant;
- HR -> hr;
- specialist roles -> specialist persona;
- Platform roles -> not school Admin;
- unknown role -> restricted;
- support override -> explicit acting context only.

## 15.3 Platform-denial tests

API and web:

- Admin receives `403` from every Platform controller family;
- Admin cannot render Platform layout children;
- Admin command palette contains no Platform link;
- direct URL returns restricted state;
- browser history/back does not reveal Platform content.

## 15.4 Navigation tests

For Admin with full tenant permissions:

- all core module groups render;
- finance/payroll/accounting render;
- settings render;
- enabled M8/M9/M10/M13 render;
- disabled modules do not render in operations;
- no Platform group renders;
- active route selection works for nested pages and hash links;
- collapsed and mobile navigation remain accessible.

## 15.5 Route matrix tests

Create a data-driven test covering:

```text
route
required module
expected Admin result
expected teacher result
expected principal result
expected specialist result
```

At minimum cover every top-level and high-risk route in the feature matrix.

## 15.6 Module smoke tests

Replace the stale broad Admin smoke with bounded suites:

```text
admin-command-centre.spec.ts
admin-students-admissions.spec.ts
admin-attendance.spec.ts
admin-fees.spec.ts
admin-academics.spec.ts
admin-activity-homework-timetable.spec.ts
admin-hr-payroll.spec.ts
admin-accounting.spec.ts
admin-communications.spec.ts
admin-settings-governance.spec.ts
admin-enabled-services.spec.ts
admin-platform-denial.spec.ts
```

Each suite should:

- use stable API-backed fixtures;
- assert page title and primary job;
- assert one core workflow;
- assert loading/empty/error where practical;
- avoid brittle styling selectors;
- avoid `locatorA || locatorB` JavaScript fallbacks;
- use exact route and permission setup.

## 15.7 High-risk E2E tests

Cover:

- refund/reversal;
- attendance correction;
- result publication/withdrawal;
- payroll post/reversal;
- journal post/reversal;
- fiscal reopen;
- user suspension;
- risky role update;
- notice withdrawal;
- sensitive export.

Assertions:

- impact summary visible;
- reason required;
- backend denial if missing;
- audit reference returned;
- original record preserved;
- downstream summaries refresh.

## 15.8 Accessibility tests

- keyboard navigation;
- focus management;
- dialog/drawer semantics;
- table headers;
- status accessible name;
- color-independent status;
- screen-reader mutation announcement;
- responsive overflow.

---

## 16. Delivery Plan

## Slice ADM-P0-01 — Full tenant Admin permissions

### Objective

Make Admin a complete school operator without Platform capability.

### Changes

- remove Admin finance exclusions;
- add permission set equation tests;
- update Config Owner model;
- verify seed role synchronization and migration behavior.

### Exit criteria

- Admin can call M3/M7 payroll/M11 APIs;
- Admin has no Platform permission;
- role seed and existing tenants update safely.

---

## Slice ADM-P0-02 — Persona and Platform separation

### Changes

- remove Platform roles from school Admin resolution;
- add restricted fallback persona;
- preserve audited support override behavior;
- update web and API tests.

### Exit criteria

- unknown role fails closed;
- Platform role cannot enter school operations without override;
- Admin cannot enter Platform.

---

## Slice ADM-P0-03 — Admin navigation completeness

### Changes

- restructure Admin groups;
- include finance, payroll, and accounting;
- add entitlement-aware service groups;
- update command palette and active-route rules;
- update route matrix tests.

### Exit criteria

- every enabled school module has a discoverable Admin hub;
- no Platform item appears;
- no duplicate specialist tree is rendered.

---

## Slice ADM-P0-04 — High-risk action standard

### Changes

- shared impact/reason/confirmation components;
- standard backend DTO expectations;
- migrate the highest-risk finance, user/role, student lifecycle, and academic actions first.

### Exit criteria

- reason and audit evidence are enforced;
- original records remain immutable;
- direct API bypass is rejected.

---

## Slice ADM-P1-01 — Admin Command Centre

### Changes

- expand server dashboard projection;
- add module health matrix;
- add governance readiness;
- improve action drill-through;
- keep bounded query behavior.

### Exit criteria

- all enabled domains represented;
- no fake totals;
- dashboard remains usable on a 1366x768 laptop.

---

## Slice ADM-P1-02 — Approval Centre

### Changes

- typed approval aggregation;
- queue/detail/decision UI;
- canonical module deep links;
- separation-of-duties indicators.

### Exit criteria

- at least notice, finance adjustment, attendance correction, leave, result publication, and payroll approvals integrate.

---

## Slice ADM-P1-03 — Readiness and context

### Changes

- branch/academic/fiscal context bar;
- school readiness API and page;
- context-aware query keys;
- blocker ownership and drill-through.

---

## Slice ADM-P1-04 — Unified school audit

### Changes

- tenant audit index;
- domain filters;
- detail lineage;
- protected export;
- link module histories.

---

## Slice ADM-P1-05 — Settings governance

### Changes

- Admin receives manage access for every school domain;
- Config Owner receives delegate treatment;
- readiness and recent changes;
- safe modules/integrations language;
- role editor excludes Platform permissions.

---

## Slice ADM-P1-06 — Admin E2E replacement

### Changes

- retire or rewrite stale `admin-smoke.spec.ts`;
- add bounded module suites;
- add Platform-denial and high-risk flow tests.

---

## Slice ADM-P2-01 — Multi-branch maturity

- global branch context;
- branch-scoped operations;
- consolidated reporting;
- inter-branch accounting/readiness where supported;
- explicit all-branch labeling.

---

## Slice ADM-P2-02 — Enabled service maturity

- complete Library Admin pages;
- complete Transport Admin pages;
- complete Canteen Admin pages;
- connect finance and audit handoffs;
- preserve entitlement gates.

This slice does not override current pilot prioritization. It defines the final Admin surface when those modules are active.

---

## Slice ADM-P2-03 — Learning Admin maturity

- policy and retention;
- resources;
- school-wide activity/session administration;
- participation reports;
- preserve M13 release and entitlement gate.

---

## 17. Migration and Existing Tenant Safety

Changing the Admin preset affects existing role assignments.

### Required migration behavior

- update canonical system role permissions idempotently;
- preserve custom roles;
- do not duplicate role-permission rows;
- log permission expansion;
- provide release note to school owners;
- consider requiring Admin users to re-authenticate after sensitive permission expansion;
- invalidate cached session permissions;
- verify support overrides and Platform roles remain unchanged.

### Seed requirements

Canonical seed tests should assert the Admin role contains finance, payroll, and accounting permissions and excludes Platform permissions.

---

## 18. Verification Commands

Run the repository-standard commands relevant to changed files, including:

```bash
pnpm --filter @schoolos/core typecheck
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web test:e2e
pnpm verify:openapi
pnpm verify:deploy
```

Use focused tests during slices, then the full required release gate before merge.

Document pre-existing failures separately. Do not mark a slice complete if it introduces or hides new failures.

---

## 19. Acceptance Criteria

### Authorization

- Admin has every tenant-scoped school permission.
- Admin has no Platform or cross-tenant permission.
- Config Owner is full Admin plus delegation/continuity safeguards.
- unknown roles fail closed.
- Platform roles do not resolve to school Admin.

### Navigation

- every enabled school module is discoverable;
- finance/payroll/accounting are present;
- settings is complete;
- no Platform link is present;
- disabled modules are correctly represented.

### Dashboard

- all enabled school domains have bounded status;
- top actions are real and permission-safe;
- partial data is explicit;
- branch/year/period context is visible.

### Workflows

- Admin can complete representative workflows in M1–M13 and M15 where enabled;
- high-risk actions require impact, reason, confirmation, and audit;
- official totals remain backend-owned;
- protected files remain protected.

### Platform isolation

- web denies `/platform/*`;
- API denies Platform functions;
- no Platform permission can be granted through school settings;
- safe integration and entitlement status do not expose secrets.

### Quality

- responsive at 1366x768, 1024 px, and narrow emergency view;
- keyboard and screen-reader accessible;
- route and persona tests are data-driven;
- full Admin E2E matrix passes;
- documentation and implementation remain aligned.

---

## 20. Final Implementation Rule

```text
Do not solve full Admin access by turning off authorization.

Solve it by granting the Admin every tenant-scoped school capability,
keeping operation-level guards and high-risk controls,
and excluding the Platform plane by construction.
```