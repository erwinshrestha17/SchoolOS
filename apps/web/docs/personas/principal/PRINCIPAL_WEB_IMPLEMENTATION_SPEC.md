# SchoolOS Principal Web — Implementation Specification

**Status:** Proposed implementation plan  
**Depends on:** Principal persona audit and design specification  
**Priority:** P0 authorization safety first, then P1 leadership workflow maturity

---

## 1. Objective

Implement a Principal web experience that is:

- Explicitly authorized.
- Leadership-focused.
- Read-only by default outside designated approval workflows.
- Server-projected and tenant-scoped.
- Separate from Admin, Teacher, HR, and Accountant operations.
- Consistent with the current Nepal-scoped P0/P1 roadmap.

The implementation must remove the current dependency on broad role inheritance and shared operator-shaped pages.

---

## 2. Scope

### Included

- Principal permission preset.
- Principal sidebar and route map.
- Principal executive dashboard.
- Cross-module attention centre.
- Cross-module approval centre.
- Principal compositions for Students, Admissions, Attendance, Academics, Staff, Finance, Notices, Activity, Reports, Audit, and Notifications.
- Permission and direct-route enforcement.
- Loading, empty, error, partial, stale, and restricted states.
- Principal contract tests and E2E coverage.

### Excluded

- M8 Library.
- M9 Transport.
- M10 Canteen.
- M13 Learning Layer.
- Open chat.
- International curriculum work.
- Platform operator controls.
- Institutional settings unless the same user separately holds `school_config_owner`.

---

# 3. P0 workstream — authorization correction

## PPR-P0-01 — Replace Principal denylist with explicit allowlist

### Current problem

`systemRolePermissions.principal` is derived from all tenant permissions minus an exclusion list.

This is unsafe because every new tenant permission may silently flow into the Principal role unless explicitly excluded.

### Required implementation

Create a dedicated explicit list:

```ts
const PRINCIPAL_PERMISSION_KEYS: PermissionKey[] = [
  // identity and own workspace
  'settings:read_public',
  'settings:read',
  'notifications:view_own',

  // school-level read / oversight
  'students:read',
  'classes:read',
  'sections:read',
  'academic_years:read',
  'attendance:read',
  'academics:read',
  'results:read',
  'marks:read',
  'staff:read',
  'hr:read',
  'notices:read',
  'activity_feed:read',
  'reports:read',

  // principal-safe finance read
  'accounting:read',
  'accounting:accounts:read',
  'accounting:reports:read',
  'accounting:audit:read',

  // designated approval permissions — exact catalogue keys must be verified
  // attendance correction / reopen review
  // result publication / withdrawal review
  // marks unlock review
  // notice approval
];
```

The exact key list must be reconciled with `permissionCatalog` and existing backend decorators. Do not invent unsupported permission names without adding the corresponding backend contract, migration/seed behavior, and tests.

### Required exclusions verified by test

A Principal must not receive by default:

```text
students:create
students:update
students:manage_lifecycle
guardians:create
guardians:update
enrollments:create
attendance:mark
attendance:manage
academics:manage
academics:enter_marks
marks:manage
staff:create
staff:update
hr:manage
payroll:*
fees:manage
payments:*
receipts:manage
ledger:read
accounting:journals:create
accounting:journals:submit
accounting:journals:approve
accounting:journals:post
accounting:settings:update
settings:manage
settings:delegate
library:manage
transport:manage
transport:operate
canteen:*
```

### Acceptance tests

- New tenant permissions are not automatically added to Principal.
- Principal may read permitted summaries.
- Principal cannot create student records.
- Principal cannot mark attendance.
- Principal cannot enter marks.
- Principal cannot add staff.
- Principal cannot run payroll.
- Principal cannot create journals or collect payments.
- Principal cannot access institutional settings without separate role assignment.

---

## PPR-P0-02 — Separate persona from additional delegated roles

A user may hold `principal` plus another explicit role.

Rules:

- Principal shell remains the default when `principal` is present unless a full Admin / School Configuration Owner role intentionally takes precedence under the approved persona policy.
- Additional capabilities may reveal narrowly delegated actions.
- Page composition must not infer broad operational authority from the Principal label.
- Every delegated action must be permission-gated and backend-enforced.

Add tests for:

```text
principal only
principal + notice approver
principal + finance approver
principal + school_config_owner
principal + teacher assignment
```

The product owner must confirm persona precedence for dual-role users. Current `resolveSchoolWebPersona` gives full Admin roles precedence over Principal and Teacher persona precedence before Principal.

---

## PPR-P0-03 — Direct route denial matrix

Frontend navigation filtering is insufficient.

Add API and route-level tests proving a Principal-only session cannot use operational write routes.

Minimum direct URL matrix:

| Route / operation | Expected |
|---|---|
| `/dashboard/admissions/new` | Denied or read-only redirect |
| Student create API | 403 |
| Student lifecycle update API | 403 |
| `/dashboard/attendance/mark` | Denied |
| Attendance submission API | 403 |
| `/dashboard/attendance/offline-drafts` | Denied |
| `/dashboard/academics/marks` | Read-only or denied; no write controls |
| Marks write API | 403 |
| `/dashboard/academics/exam-terms` | Denied without separate manage permission |
| `/dashboard/hr/staff/new` or create action | Denied |
| Staff create API | 403 |
| `/dashboard/payroll/*` | Denied unless separately delegated |
| `/dashboard/accounting/journals/new` | Denied |
| Journal create API | 403 |
| Payment collection / reversal routes | Denied |
| `/dashboard/settings/*` institutional routes | Denied without settings role |
| M8/M9/M10 operational routes | Denied or module hidden for active scope |

---

## PPR-P0-04 — Remove deferred modules from Principal navigation

Change `principalNavGroups`:

- Remove `/dashboard/operations` during current P0 scope.
- Do not include Library, Transport, or Canteen child routes.
- Add a contract test asserting no deferred module route appears for Principal.

Reactivation requires a separate product decision and Principal read-only composition.

---

# 4. Navigation and route migration

## Target navigation config

```ts
export const principalNavGroups: NavGroup[] = [
  {
    label: 'Leadership',
    items: [
      { href: '/dashboard', label: 'Executive Dashboard' },
      { href: '/dashboard/attention', label: 'Attention Centre' },
      { href: '/dashboard/approvals', label: 'Approval Centre' },
    ],
  },
  {
    label: 'Students',
    items: [
      { href: '/dashboard/students/overview', label: 'Enrollment Overview' },
      { href: '/dashboard/admissions/overview', label: 'Admissions Overview' },
    ],
  },
  {
    label: 'School Readiness',
    items: [
      { href: '/dashboard/attendance/overview', label: 'Attendance Oversight' },
      { href: '/dashboard/academics/readiness', label: 'Academic Readiness' },
      { href: '/dashboard/hr/overview', label: 'Staff Overview' },
      { href: '/dashboard/finance-overview', label: 'Finance Overview' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/dashboard/notices', label: 'Notices' },
      { href: '/dashboard/activity/oversight', label: 'Activity Oversight' },
      { href: '/dashboard/notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'Evidence',
    items: [
      { href: '/dashboard/reports', label: 'Reports' },
      { href: '/dashboard/audit', label: 'Leadership Audit' },
    ],
  },
];
```

## Current-to-target route matrix

| Current | Target | Migration behavior |
|---|---|---|
| `/dashboard#needs-attention` | `/dashboard/attention` | Replace hash nav; dashboard panel links to queue |
| `/dashboard/notices/approvals` | `/dashboard/approvals` | Notice approvals become one filtered category |
| `/dashboard/students` | `/dashboard/students/overview` | Principal route uses overview; Admin keeps operational page |
| `/dashboard/admissions` | `/dashboard/admissions/overview` | Principal route uses overview; Admin keeps operations |
| `/dashboard/attendance` | `/dashboard/attendance/overview` | Persona-aware redirect or dedicated route |
| `/dashboard/academics` | `/dashboard/academics/readiness` | Principal-specific readiness route |
| `/dashboard/hr` | `/dashboard/hr/overview` | Principal-specific staff route |
| `/dashboard/accounting` | `/dashboard/finance-overview` | Separate Principal finance composition |
| `/dashboard/operations` | Removed from active Principal nav | Direct access follows permission/entitlement rules |
| `/dashboard/activity` | `/dashboard/activity/oversight` | Leadership moderation / consent composition |
| `/dashboard/accounting/audit` | `/dashboard/audit` | Cross-module leadership audit |

Use explicit redirects only when they do not create loops or reveal forbidden routes.

---

# 5. P0 dashboard corrections

## PPR-P0-05 — Principal-safe top summary cards

Current `DashboardSummaryStrip` excludes finance and staff for Principal.

Change the card builder to support Principal-safe models:

```text
Attendance completion
Academic blockers
Finance exception categories / read-only selected metric
Staff coverage
Needs attention
```

Do not use Accountant- or HR-sensitive values.

Potential implementation:

```ts
const includePrincipalFinance = persona === 'principal';
const includePrincipalStaff = persona === 'principal';
```

However, do not simply reuse operational card copy. Add dedicated Principal card builders so labels and drill-through routes go to Principal pages.

### Required tests

- Principal receives no collection-entry action.
- Principal finance card links to `/dashboard/finance-overview`.
- Principal staff card links to `/dashboard/hr/overview`.
- Unavailable module data renders `Unavailable`, never `0`.
- Permission-denied modules are absent.

---

## PPR-P0-06 — Dashboard module route mapping

Update `moduleWorkspaceRoute` or add persona-aware route resolution.

Current module routes may open operator pages.

Required mapping for Principal:

| Module | Principal route |
|---|---|
| M1 Students | `/dashboard/students/overview` |
| M2 Attendance | `/dashboard/attendance/overview` |
| M3 Fees | `/dashboard/finance-overview` |
| M4 Academics | `/dashboard/academics/readiness` |
| M7 HR/Payroll | `/dashboard/hr/overview` |
| M10 Communications alias | `/dashboard/notices` |
| M11 Accounting | `/dashboard/finance-overview` |

Use a function such as:

```ts
moduleWorkspaceRoute(module, persona)
```

rather than a single route for all personas.

---

# 6. New frontend routes and components

## New routes

```text
apps/web/app/dashboard/attention/page.tsx
apps/web/app/dashboard/approvals/page.tsx
apps/web/app/dashboard/students/overview/page.tsx
apps/web/app/dashboard/admissions/overview/page.tsx
apps/web/app/dashboard/attendance/overview/page.tsx
apps/web/app/dashboard/academics/readiness/page.tsx
apps/web/app/dashboard/hr/overview/page.tsx
apps/web/app/dashboard/finance-overview/page.tsx
apps/web/app/dashboard/activity/oversight/page.tsx
apps/web/app/dashboard/audit/page.tsx
```

The current routes may remain for operational personas.

## Recommended feature components

```text
components/principal/principal-page-header.tsx
components/principal/leadership-kpi-strip.tsx
components/principal/attention-centre.tsx
components/principal/attention-detail-panel.tsx
components/principal/approval-centre.tsx
components/principal/approval-decision-panel.tsx
components/principal/readiness-matrix.tsx
components/principal/readiness-domain-card.tsx
components/principal/evidence-drawer.tsx
components/principal/enrollment-overview.tsx
components/principal/admissions-overview.tsx
components/principal/attendance-oversight.tsx
components/principal/academic-readiness.tsx
components/principal/staff-overview.tsx
components/principal/finance-overview.tsx
components/principal/activity-oversight.tsx
components/principal/leadership-audit.tsx
```

Prefer shared primitives for:

- `ModuleHeader`.
- `SummaryCard` / `SummaryGrid`.
- `WorkspaceTabs`.
- `FilterBar`.
- `WorkSurface`.
- `DataTable` or paginated table.
- `StatusBadge`.
- `LoadingState`.
- `ErrorState`.
- `EmptyState`.
- `PermissionDenied`.
- `ProtectedFileButton`.

Do not duplicate general UI primitives inside `components/principal`.

---

# 7. Backend contracts

The following contracts are target requirements. Their exact route names and DTOs require OpenAPI confirmation before implementation.

## 7.1 Principal attention queue

Recommended endpoint:

```http
GET /principal/attention
```

Query:

```text
severity
module
category
ownerId
status
ageBucket
search
page
limit
```

Response:

```ts
interface PrincipalAttentionPage {
  summary: {
    critical: number | null;
    approvalRelated: number | null;
    overdue: number | null;
    dueToday: number | null;
    unassigned: number | null;
  };
  items: PrincipalAttentionItem[];
  page: number;
  limit: number;
  total: number;
  generatedAt: string;
  status: 'ready' | 'partial';
}
```

Item:

```ts
interface PrincipalAttentionItem {
  id: string;
  module: string;
  category: string;
  severity: 'critical' | 'high' | 'normal';
  title: string;
  description: string;
  impactLabel: string;
  impactCount?: number | null;
  owner?: { id: string; name: string } | null;
  occurredAt: string;
  dueAt?: string | null;
  status: string;
  sourceRoute?: string | null;
  evidenceCount: number;
}
```

The server must project only Principal-authorized items.

## 7.2 Principal approval queue

Recommended endpoint:

```http
GET /principal/approvals
GET /principal/approvals/:id
POST /principal/approvals/:id/decision
```

Decision payload:

```ts
interface PrincipalApprovalDecisionInput {
  action: 'APPROVE' | 'REJECT' | 'RETURN';
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
}
```

Response must include authoritative post-decision state and audit reference.

Controls:

- Tenant scope from auth context.
- Explicit approval capability.
- Separation-of-duties check.
- Expected version / optimistic concurrency.
- Idempotency.
- Immutable reason and actor.
- No client-provided tenant identity.

## 7.3 Principal overview contracts

Prefer purpose-limited endpoints or purpose-limited DTO projection:

```text
GET /principal/enrollment-overview
GET /principal/admissions-overview
GET /principal/attendance-overview
GET /principal/academic-readiness
GET /principal/staff-overview
GET /principal/finance-overview
GET /principal/communication-overview
GET /principal/activity-oversight
GET /principal/audit-events
```

Do not fetch full Admin/HR/Accountant payloads and hide fields in React.

## 7.4 Principal finance contract

Must not expose:

- Journal write controls.
- Account configuration mutation data.
- Bank account secrets.
- Unnecessary payer details.
- Staff salary detail.

Recommended response domains:

```text
period context
collection performance
receivables aging
cash and bank totals
income / expenditure summary
reconciliation exception count
material approval queue
financial statement availability
source posting health
```

## 7.5 Leadership audit contract

Must aggregate only approved high-risk tenant events.

Required fields:

```text
event id
event type
risk level
module
occurredAt
actor safe identity
affected scope safe label
result
reason
audit correlation id
redacted before/after summary
related approval id
protected evidence references
```

---

# 8. Persona-aware page composition strategy

Use one of these patterns per module.

## Pattern A — dedicated Principal route

Preferred when the Principal job is structurally different.

Use for:

- Finance Overview.
- Academic Readiness.
- Staff Overview.
- Attention Centre.
- Approval Centre.
- Leadership Audit.
- Activity Oversight.

## Pattern B — shared route, persona-specific composition

Use only when filters, data, and actions remain closely aligned.

Potentially suitable for:

- Notifications.
- Reports catalogue, provided report definitions are server-filtered.
- Notices, when header/actions and default tab change by persona.

## Pattern C — shared read-only detail

A record detail may be shared when:

- The API DTO is purpose-limited.
- Fields are permission-filtered.
- Mutations are absent without explicit permission.
- Audit and protected-file access are enforced.

Do not place a `Principal` conditional throughout a large operator component. Extract compositions with explicit inputs and tests.

---

# 9. P1 workstream — workflow maturity

## PPR-P1-01 — Dedicated Attention Centre

Deliver:

- URL-backed filters.
- Pagination.
- Severity ordering.
- Owner and age.
- Evidence drawer.
- Resolved history.
- Safe source links.
- Partial-data status.

## PPR-P1-02 — Cross-module Approval Centre

Deliver:

- Module tabs.
- Queue summary.
- Detailed decision review.
- Evidence completeness.
- Before / after comparison.
- Approve / reject / return.
- Required reason.
- Version conflict handling.
- Idempotent decision submission.
- Decision audit history.

## PPR-P1-03 — Principal-specific module overview routes

Implement the pages in the sequence:

1. Attendance Oversight.
2. Academic Readiness.
3. Enrollment / Admissions Overview.
4. Staff Overview.
5. Finance Overview.
6. Notices / Activity Oversight.
7. Leadership Audit.

This order prioritizes authoritative P0 workflows before broader management reporting.

## PPR-P1-04 — Curated Principal reports

- Server-filter report definitions by permission and persona purpose.
- Add data-classification metadata.
- Preserve protected export history.
- Prevent unrestricted student or salary exports.

## PPR-P1-05 — Leadership audit aggregation

- Create cross-module event taxonomy.
- Add risk classification.
- Redact sensitive fields.
- Link approval and evidence.
- Add protected export.

---

# 10. State and error requirements

Every Principal page must implement:

| State | Requirement |
|---|---|
| Loading | Preserve header/context; skeleton matches final layout |
| Empty | Explain there is no open work; no unsafe create CTA |
| No results | Preserve filters; offer reset |
| Error | School-friendly message, retry, preserve filters / draft reason |
| Partial | Keep successful panels and identify unavailable domains |
| Permission denied | No forbidden record details; explain access boundary |
| Module locked | Explain module is not enabled; no fake values |
| Stale | Show last updated and refresh; do not imply current status |
| Conflict | Explain data changed; refresh decision evidence before retry |
| Decision pending | Disable duplicate submission and show progress |
| Decision success | Show authoritative state and invalidate relevant queues |
| File unavailable | Explain missing / expired / restricted protected file |

---

# 11. Frontend query rules

- Query keys include tenant, academic year, period, filters, page, and persona-sensitive contract identity where needed.
- Do not put a client-selected persona into an authorization request.
- Server resolves Principal from authenticated roles and permissions.
- Use `staleTime` appropriate to the workflow; approvals and attention are shorter-lived than historical reports.
- Refetch queues after decisions.
- Preserve previous safe data during refresh.
- Cancel stale requests when filters change.
- Growing queues use server pagination.
- Do not compute official counts from loaded page items.

---

# 12. Security and privacy requirements

- Tenant scope comes from authenticated context.
- Backend permissions and entitlements remain authority.
- Protected files use authenticated File Registry helpers.
- Sensitive list fields are redacted server-side.
- Salary, medical, disability, custody, safeguarding, and bank data require separate explicit permissions.
- Decision actions record actor, reason, source, time, and affected record version.
- Session revocation removes Principal access immediately.
- Direct URLs cannot bypass page composition.
- Exports are audited and classification-aware.
- No raw error, Prisma, provider, storage, or object-key data reaches the Principal UI.

---

# 13. Test specification

## 13.1 Core role tests

File candidates:

```text
packages/core/src/permissions/roles.spec.ts
packages/core/src/school-web-persona.spec.ts
packages/core/src/dashboard-persona.spec.ts
```

Tests:

- Principal explicit allowlist snapshot.
- Principal does not inherit newly added tenant permission.
- Principal persona resolution.
- Dual-role precedence.
- Dashboard modules.
- Attention filtering.
- Next-action filtering.

## 13.2 Sidebar contract tests

Update `apps/web/test/sidebar-navigation.test.mjs`.

Assert Principal shows:

```text
Executive Dashboard
Attention Centre
Approval Centre
Enrollment Overview
Admissions Overview
Attendance Oversight
Academic Readiness
Staff Overview
Finance Overview
Notices
Activity Oversight
Notifications
Reports
Leadership Audit
```

Assert Principal does not show:

```text
New Admission
Mark Attendance
Enter Marks
Payroll
Accounting Operations
Library
Transport
Canteen
Institutional Settings
```

## 13.3 Page composition tests

Add contract tests that inspect source or render behavior for:

- No `Mark Attendance` action in Principal Attendance page.
- No `Create Exam Term` / `Enter Marks` in Academic Readiness.
- No `Add Staff` in Staff Overview.
- No voucher / journal quick actions in Finance Overview.
- No `Create Activity` primary action in Activity Oversight.
- Approval centre requires reason and idempotency input.

## 13.4 API authorization tests

For every Principal overview and decision endpoint:

- Principal allowed for read.
- Principal denied for unrelated write.
- Admin does not automatically receive financial write if excluded by policy.
- Accountant cannot approve Principal-only academic decisions without permission.
- Cross-tenant IDs denied.
- Suspended tenant denied.
- Disabled module denied.
- Missing entitlement denied.
- Access failure does not reveal record existence.

## 13.5 E2E Principal journey

Recommended journey:

```text
Sign in as Principal
→ Executive Dashboard loads server-projected data
→ Open Attention Centre
→ Filter Academics / High severity
→ Open item evidence
→ Open linked Approval Centre request
→ Review before/after and evidence
→ Return request with a reason
→ Queue updates
→ Audit event appears
→ Directly visit attendance marking route
→ Access is denied
→ Open Finance Overview
→ Confirm no journal or payment controls
→ Sign out
```

Test responsive behavior at:

- 1440 × 900.
- 1366 × 768.
- 1024 × 768.
- 768 × 1024.

---

# 14. Analytics and observability

Use privacy-safe events only.

Recommended events:

```text
principal_dashboard_viewed
principal_attention_filter_changed
principal_attention_item_opened
principal_approval_opened
principal_approval_decision_submitted
principal_approval_conflict
principal_report_requested
principal_protected_export_downloaded
principal_forbidden_route_blocked
```

Do not include student names, salary values, marks, or sensitive reasons in analytics payloads.

Operational metrics:

- Principal overview endpoint latency.
- Approval decision failure rate.
- Version conflict rate.
- Partial dashboard frequency.
- Protected export failure rate.
- Forbidden direct-route attempts.

---

# 15. Delivery sequence

## Slice 1 — Principal authorization baseline

- Explicit permission allowlist.
- Direct-route API tests.
- Remove deferred navigation.
- Fix sidebar labels and routes.
- Preserve dashboard projection tests.

## Slice 2 — Dashboard and persona-aware routing

- Principal route resolver.
- Finance and staff summary cards.
- Dashboard links to Principal pages.
- Dedicated Attention and Approval route shells.

## Slice 3 — Attendance and Academic Readiness

- Purpose-limited backend contracts.
- Principal pages.
- Correction / result approval linkage.
- Direct operational write denial.

## Slice 4 — Enrollment, Admissions, and Staff

- Purpose-limited overview contracts.
- Read-only directories and queues.
- Remove Admin / HR actions.

## Slice 5 — Finance Overview

- Principal finance DTO.
- Statements and exception drill-down.
- No accountant operations.

## Slice 6 — Communication, Reports, and Audit

- Notice leadership composition.
- Activity Oversight.
- Curated Reports.
- Leadership Audit.

---

# 16. Universal definition of done

A Principal slice is complete only when all applicable items pass:

- Explicit permission rule.
- Tenant and entitlement enforcement.
- Purpose-limited backend DTO.
- OpenAPI update.
- Shared contract update.
- Principal-specific route / composition.
- Loading state.
- Empty state.
- Error state.
- Permission-denied state.
- Partial and stale state.
- Protected-file handling.
- Audit event for decisions.
- Unit tests.
- Integration tests.
- Cross-tenant tests.
- Direct URL tests.
- Web contract tests.
- E2E Principal journey.
- Laptop and tablet visual verification.
- Accessibility check.
- Evidence entry in the controlled-pilot roadmap.

---

# 17. Acceptance criteria

The Principal web redesign passes when:

1. A Principal-only user sees a leadership-specific navigation and page composition.
2. The role no longer inherits all current or future tenant permissions.
3. Routine operational writes are absent and backend-denied.
4. Attention and Approval are real dedicated queues.
5. Attendance, Academics, Staff, and Finance have Principal-specific pages.
6. Dashboard finance and staff summaries are available when authorized.
7. Deferred modules are absent from active navigation.
8. Reports are curated and protected.
9. Audit is cross-module and high-risk, not accounting-only.
10. Every high-risk decision requires evidence, reason, concurrency control, and audit.
11. Direct URLs cannot reopen operational access.
12. The UI remains usable on a standard school laptop and accessible by keyboard.
