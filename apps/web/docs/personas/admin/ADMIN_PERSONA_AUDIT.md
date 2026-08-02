# SchoolOS Admin Persona Audit

**Document type:** Repository-grounded persona and authorization audit  
**Persona:** School Admin  
**Surface:** School web application (`/dashboard/*`)  
**Repository:** `erwinshrestha17/SchoolOS`  
**Audit baseline:** `main` at `59abb3445833bca0feff470ea25b4ae209f91cb3`  
**Status:** Design and implementation input; not GA certification  

---

## 1. Audit Objective

This audit determines:

1. what the current SchoolOS Admin persona can see and operate;
2. which school functions are currently missing from the Admin preset;
3. where the web navigation and route model do not reflect full school administration;
4. how Admin must differ from SchoolOS Platform operators;
5. what target capability model, information architecture, pages, and controls are required.

The governing user requirement is:

```text
School Admin has full access to every tenant-scoped SchoolOS capability
required to operate that school.

School Admin has no Platform access.
Platform is restricted to SchoolOS developers and explicitly authorized
platform operators.
```

This requirement changes the earlier target persona rule that treated payroll, accounting, and some sensitive school functions as separately granted by default. The target in this package is a true tenant-scoped school super-administrator.

---

## 2. Scope Boundary

### Included

- School Operations plane: `/dashboard/*`
- School Settings plane: `/dashboard/settings/*`
- All enabled tenant modules:
  - M0 school-side configuration
  - M1 Admissions and Student Profiles
  - M2 Smart Attendance
  - M3 Fees and Receipts
  - M4 Academics, Exams, CAS, and Report Cards
  - M5 Activity Feed and Milestones
  - M6 Homework and Timetable
  - M7 HR and Payroll
  - M8 Library
  - M9 Transport
  - M10 Canteen
  - M11 Accounting and Finance
  - M12 Notifications and Delivery
  - M13 Learning Layer when enabled
  - M15 Notices and Announcements
- Users, roles, school policies, protected exports, and tenant audit evidence
- Branch-aware and academic-year-aware school operations

### Excluded

- `/platform/*`
- Cross-tenant administration
- Tenant provisioning and suspension
- SaaS plans and subscriptions
- Platform billing
- Global provider credentials and secrets
- Platform API keys
- Global queue operations
- Support override issuance
- Platform health and infrastructure controls
- M14 Intelligence / AI runtime, which remains roadmap-only
- Removed open chat and conversation surfaces

### Conditional modules

M8, M9, M10, and M13 must remain entitlement-gated. Full Admin authority means full authority **inside an enabled school module**; it does not mean the school Admin can bypass the school's subscription or enable platform-controlled entitlements.

---

## 3. Sources Audited

### Authorization and persona resolution

- `packages/core/src/permissions/roles.ts`
- `packages/core/src/school-web-persona.ts`
- `packages/core/src/dashboard-persona.ts`
- `apps/web/lib/school-web-persona.ts`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/platform/layout.tsx`

### Navigation and shell

- `apps/web/components/layout/sidebar.tsx`
- `apps/web/components/layout/sidebar-persona-nav.config.ts`
- `apps/web/components/layout/command-palette.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/dashboard/admin-dashboard.tsx`
- `apps/web/components/dashboard/operational-dashboard-layout.tsx`

### Settings

- `apps/api/src/settings/school-settings-navigation-v1.service.ts`
- `packages/core/src/school-settings-navigation.ts`
- `apps/web/components/settings/school-settings-catalog.ts`
- `apps/web/components/settings/settings-route-frame.tsx`
- `apps/web/components/settings/settings-control-center.tsx`

### Representative module workspaces

- `apps/web/app/dashboard/students/page.tsx`
- `apps/web/app/dashboard/admissions/page.tsx`
- `apps/web/components/attendance/attendance-m2-workspaces.tsx`
- `apps/web/components/finance/fees-workspace.tsx`
- `apps/web/app/dashboard/academics/page.tsx`
- `apps/web/app/dashboard/activity/page.tsx`
- `apps/web/app/dashboard/homework/page.tsx`
- `apps/web/app/dashboard/timetable/page.tsx`
- `apps/web/app/dashboard/hr/page.tsx`
- `apps/web/components/accounting/accounting-dashboard-view.tsx`
- `apps/web/app/dashboard/operations/page.tsx`
- `apps/web/components/notices/notice-queue-workspace.tsx`
- `apps/web/app/dashboard/reports/page.tsx`
- `apps/web/components/service-requests/service-requests-workspace.tsx`
- `apps/web/app/dashboard/learning/page.tsx`

### Product and design baseline

- `apps/web/AGENTS.md`
- `apps/web/docs/DESIGN_SYSTEM.md`
- `docs/Persona/SchoolOS_Module_Features_and_Persona_Platform_Mapping.md`
- `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
- `docs/requirements/SCHOOLOS_SRS.md`
- `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`

### Test evidence

- `apps/web/e2e/admin-smoke.spec.ts`
- `apps/web/test/sidebar-navigation.test.mjs`
- `apps/api/src/teacher-scope/school-web-persona.spec.ts`

---

## 4. Target Admin Definition

The School Admin is the highest-authority **tenant-scoped school operator**.

The Admin must be able to:

- configure the school;
- manage school users, roles, and assignments;
- operate every enabled school module;
- inspect every tenant-scoped report and audit record;
- execute or approve high-risk school actions;
- delegate operational work to specialist personas;
- recover from school-side errors and failed workflows;
- manage branch, academic-year, fiscal-year, and module context;
- see complete operational readiness without entering the Platform plane.

The Admin must not be able to:

- open another tenant;
- provision or suspend tenants;
- alter SaaS plans or subscriptions;
- view or rotate provider secrets;
- access platform API keys;
- issue support overrides;
- manage global workers, infrastructure, or queues;
- access `/platform/*` merely because the user is a school Admin.

### Governing rule

```text
Admin owns the school workspace.
Platform owns the SchoolOS service.
```

---

## 5. Current Persona Resolution Audit

### Current behavior

`packages/core/src/school-web-persona.ts` places these roles in `FULL_ADMIN_ROLES`:

```text
admin
school_config_owner
platform_super_admin
platform_support
platform_billing_admin
```

It also defaults every unmatched non-teacher session to `admin`.

### Existing protection

`apps/web/app/dashboard/layout.tsx` blocks platform users from school operations unless an explicit support override is active. `apps/web/app/platform/layout.tsx` blocks ordinary school roles from `/platform/*`.

### Audit judgment

The route-level platform boundary is directionally correct, but persona resolution is semantically overloaded:

- school Admin and Platform Operator resolve to the same school web persona;
- unknown or weakly shaped roles fall back to the Admin shell;
- support override behavior is enforced later in the route tree rather than reflected in the persona type.

### Required target

```text
admin                  -> admin
school_config_owner    -> admin_owner or admin
platform_*             -> platform_operator
unknown school role    -> restricted_school_user
support override       -> explicit acting persona from audited override context
```

The target must never infer school Admin authority from a Platform role or from a fallback branch.

---

## 6. Current Permission Preset Audit

### Current implementation

`packages/core/src/permissions/roles.ts` computes tenant permissions by excluding platform permission keys. It then applies a second exclusion list to the `admin` preset:

```text
ADMIN_EXCLUDED_FINANCE_KEYS
```

This removes permissions rooted in:

- `accounting`
- `fees`
- `payments`
- `receipts`
- `ledger`
- `payroll`
- `finance`
- `settings:finance:manage`
- `settings:accounting:manage`

The current role is therefore a broad non-financial school operator, not a full school Admin.

### Conflict with the target requirement

The target Admin must have all tenant-scoped school permissions, including:

- fee configuration and billing;
- collections and receipt controls;
- refunds, reversals, and cashier close;
- payroll setup, run, approval, posting, and protected payslips;
- chart of accounts and fiscal periods;
- journals, vouchers, bank reconciliation, expenses, payables, and reports;
- finance and accounting settings;
- source-module posting recovery.

### Required target preset

```ts
admin: TENANT_PERMISSION_KEYS
```

Where `TENANT_PERMISSION_KEYS` continues to exclude:

- every `platform:*` permission;
- `tenants:manage`;
- removed chat-write permissions;
- any future developer-only or cross-tenant permission family.

### Owner role

`school_config_owner` should remain a continuity and delegation safeguard, but it should not be the only route to complete school administration.

Recommended model:

```text
admin
  all tenant-scoped school permissions

school_config_owner
  all admin permissions
  + ownership continuity
  + delegation and ownership-transfer controls
  + protected owner-removal safeguards
```

---

## 7. Current Admin Navigation

The current Admin sidebar presents:

```text
Home
  Home
  Action Centre

Students & Admissions
  Students
  Admissions

Attendance
  Attendance

Fees & Receipts
  Fees & Receipts

Academics
  Academics
  Exams & Results
  Learning

Activities
  Activity Feed

Homework & Timetable
  Homework
  Timetable

Staff & Finance
  Staff
  Payroll
  Accounting

School Operations
  Library
  Transport
  Canteen

Notifications
  Notifications

Notices
  Notices & Announcements

Reports
  Reports & Exports
  Audit

Footer
  Settings
```

### Current navigation strengths

- The Admin receives a school-wide navigation tree.
- Navigation is permission- and entitlement-filtered.
- Platform navigation is not mixed into the sidebar.
- Settings is separated from school operations.
- Specialist modules have dedicated route families.
- Direct route access is additionally checked in `apps/web/app/dashboard/layout.tsx`.

### Current navigation weaknesses

- Full finance navigation is present in configuration but normally hidden by the Admin preset.
- Major sub-workspaces are buried behind single broad module links.
- Users, roles, academic setup, security, integrations, and school policies are hidden behind one generic Settings item.
- There is no unified Approval Centre.
- There is no unified school readiness page.
- There is no cross-module exception center beyond service requests.
- Reports and audit do not provide a complete tenant governance hierarchy.
- Admin and `school_config_owner` use the same navigation label despite materially different permission sets.
- M8/M9/M10/M13 phase and entitlement states are not obvious in the primary Admin IA.

---

## 8. Current Dashboard Audit

### Current implementation

The Admin dashboard uses the shared operational layout:

```text
Summary strip
Needs attention
Today's operations
School readiness
Latest school activity
```

The server projection for Admin currently queries:

```text
M1 Students
M2 Attendance
M3 Fees
M10 Communications
M6 Homework and Timetable
M7 HR and Payroll
```

### Strengths

- Dashboard projection is server-side and persona-resolved.
- The client rejects persona mismatches.
- Summary values come from backend-owned fields.
- Attention rows are severity-aware.
- Locked modules are not presented as fake zeroes.
- The dashboard supports loading, error, partial, and permission-safe states.

### Gaps

The dashboard does not represent the full Admin remit:

- M4 Academics is absent from the Admin projection.
- M5 Activity is absent.
- M8 Library is absent.
- M9 Transport is absent.
- M10 Canteen is absent.
- M11 Accounting is absent.
- M12 delivery health is compressed into communications.
- M13 Learning is absent.
- Settings readiness, security, users, roles, integrations, and failed jobs are absent.
- Branch and academic/fiscal context are not prominent.
- There is no consolidated approval count.
- There is no explicit platform-separation indicator.

### Required target

The Admin dashboard should be a tenant command center, not a wall of all module metrics. It should expose:

1. school-day readiness;
2. critical actions and approvals;
3. module health and blocked workflows;
4. students and admissions;
5. attendance;
6. finance and payroll;
7. academics;
8. communication delivery;
9. enabled school-service exceptions;
10. configuration and security readiness.

Detailed operations stay in module workspaces.

---

## 9. Current Feature Availability by Module

Legend:

| Status | Meaning |
|---|---|
| Available | Current Admin preset and route model normally expose the capability. |
| Partial | Some capability is visible, but permissions or page composition are incomplete. |
| Hidden by preset | Routes exist, but current Admin finance exclusions prevent access. |
| Entitlement-gated | Available only when the school module is enabled. |
| Proposed | Required by the target Admin model but no complete unified surface exists. |

### M0 — School-side Platform Core

**Current status:** Available / partial

Current Admin-accessible capabilities include:

- school identity;
- branding;
- academic year and calendar;
- classes, sections, and subjects;
- school module visibility;
- admissions policy;
- attendance policy;
- exam and report-card policy;
- homework and timetable policy;
- activity consent policy;
- communication policy;
- documents and templates;
- users;
- roles and permissions;
- security and access policy;
- tenant-scoped audit;
- safe integration status;
- module-owned settings for enabled modules.

Gaps:

- finance and accounting settings are hidden by the current Admin preset;
- entitlement status is visible but platform-owned enablement is not clearly explained everywhere;
- school onboarding, backup/restore evidence, retention, export policy, and job recovery are not organized into one governance workspace;
- high-risk settings changes do not share one universal approval and reason pattern.

### M1 — Admissions and Student Profiles

**Current status:** Available

Current surfaces include:

- admissions overview and queues;
- new admission;
- online applications;
- assessment and interview;
- document issues;
- duplicate review;
- iEMIS readiness;
- QR and ID cards;
- student directory;
- student profile and protected PDFs;
- guardian and enrollment-related workflows;
- exports and data-quality summaries.

Gaps:

- Admin information architecture splits student lifecycle work across several secondary routes without a dedicated lifecycle hub;
- guardian access, custody restrictions, sensitive fields, and recovery actions need stronger high-risk visual separation;
- branch and academic-year context should be persistent.

### M2 — Smart Attendance

**Current status:** Available

Current surfaces include:

- attendance overview;
- daily marking;
- monthly register;
- corrections;
- conflict review;
- anomaly and follow-up queues;
- reports and exports;
- offline drafts;
- attendance settings;
- class status and at-risk panels.

Gaps:

- the Admin overview prioritizes marking as the primary action even when the Admin's more common job may be exception management;
- marking, correction, lock override, and policy administration require clearer capability boundaries;
- school-day completion and teacher submission compliance should drive the landing page.

### M3 — Fees and Receipts

**Current status:** Hidden by current Admin preset

Existing route family supports:

- overview;
- collection counter;
- billing runs;
- invoice register;
- student ledgers;
- receipt center;
- refunds and reversals;
- waivers and discounts;
- cashier close;
- finance reports;
- fee heads and plans.

The current Admin preset normally cannot open these surfaces because finance permission roots are excluded.

### M4 — Academics, Exams, CAS, and Report Cards

**Current status:** Available

Existing surfaces include:

- academic overview;
- exam terms;
- assessment components;
- marks and CAS;
- report cards;
- results and publishing;
- retakes;
- marks lock review;
- promotion readiness;
- academic reporting.

Gaps:

- structure, teacher assignment, exam setup, marks operations, results, and publication need clearer route grouping;
- the overview mixes configuration and execution actions;
- high-risk publication, withdrawal, unlock, and regeneration require consistent approval patterns.

### M5 — Activity Feed and Milestones

**Current status:** Available

Existing surfaces include:

- feed;
- activity creation;
- moderation;
- gallery;
- observations;
- milestones;
- deliveries;
- reports;
- consent-aware media state.

Gaps:

- school-wide authoring, moderation, consent exceptions, media failures, and retention should be distinct page jobs;
- Admin requires a school-wide moderation command view rather than teacher-oriented filters by default.

### M6 — Homework and Timetable

**Current status:** Available

Homework surfaces include:

- today;
- all homework;
- completion report;
- templates;
- creation;
- detail and review.

Timetable surfaces include:

- weekly grid;
- versions;
- requirements;
- conflicts;
- substitutions;
- builder.

Gaps:

- homework and timetable are grouped together in sidebar labeling but are separate operational domains;
- school-wide policy, workload, publication, and conflict management need stronger Admin context;
- date-filter behavior in homework currently includes a bounded client-side fallback and should receive a backend filter contract.

### M7 — HR and Payroll

**Current status:** HR available; payroll hidden or partial

Current Admin can generally reach HR through `hr:*` permissions:

- HR dashboard;
- staff directory;
- contracts;
- staff attendance;
- leave;
- onboarding-related workflows.

Payroll routes exist for:

- payroll runs;
- readiness;
- payslips;
- reports;
- posting handoff.

The current Admin preset excludes the payroll permission family, so full payroll access is not delivered.

A further risk is that the shared HR dashboard queries payroll data while the Admin may have HR access but no payroll access, producing a potentially partial workspace.

### M8 — Library

**Current status:** Entitlement-gated and available when enabled

Existing route families include:

- library overview;
- catalog;
- copies;
- issues and returns;
- overdue;
- fines;
- borrowers;
- reports and module settings.

Current active product prioritization may defer Library implementation work, but the Admin target must include complete authority whenever the module is enabled.

### M9 — Transport

**Current status:** Entitlement-gated and available when enabled

Existing route families and operator navigation support:

- overview;
- trips;
- students;
- routes and operational configuration;
- reporting;
- stale GPS and live-status evidence.

The Admin target additionally requires complete route, stop, vehicle, driver, document, enrollment, incident, and provider-status management.

### M10 — Canteen

**Current status:** Entitlement-gated and available when enabled

Existing route families include:

- overview;
- POS;
- serving;
- enrollments;
- menu and plan controls;
- reports and operational settings.

The Admin target additionally requires wallets, vendors, stock, wastage, refunds, settlement, allergy policy, and finance handoff.

### M11 — Accounting and Finance

**Current status:** Hidden by current Admin preset

Existing Accountant routes support:

- finance dashboard;
- fees and receivables;
- collections and receipts;
- cashier close;
- bank reconciliation;
- journals;
- cash and bank;
- expenses and payables;
- payroll handoff;
- source mappings and posting batches;
- financial reports;
- accounting audit.

The current Admin preset excludes the required permission family, directly conflicting with the target full Admin requirement.

### M12 — Notifications and Delivery

**Current status:** Available / partial

Current school-side capabilities include:

- personal notifications;
- notice delivery logs;
- failure and retry routes;
- diagnostics;
- acknowledgement and report surfaces;
- safe integration status.

Gaps:

- provider credentials correctly remain Platform-owned;
- Admin needs clearer separation between templates, campaigns, delivery operations, failures, and personal inbox;
- critical delivery failures should appear in Action Centre and dashboard.

### M13 — Learning Layer

**Current status:** Entitlement-gated

Current route family includes:

- learning overview;
- activity creation;
- controlled sessions;
- attempts;
- review;
- progress.

Target Admin responsibility includes policy, retention, activity/resource administration, and school-wide reports. M13 remains disabled by default until its release gate is satisfied.

### M15 — Notices and Announcements

**Current status:** Available

Current surfaces include:

- notices list;
- composer;
- scheduled notices;
- approvals;
- delivery logs;
- recipient targeting;
- attachments;
- lifecycle state.

Gaps:

- approval, delivery, failure, acknowledgement, and correction workflows should be connected as one lifecycle;
- the current approval queue is notice-specific, not a universal school Approval Centre.

### Reports and audit

**Current status:** Partial

Existing report engine supports:

- permission-filtered report definitions;
- configurable filters;
- CSV, PDF, and JSON outputs where supported;
- queued background exports;
- report snapshot history;
- protected downloads;
- retry of failed export jobs.

Current Admin finance exclusions prevent the full report catalogue from appearing.

Existing audit navigation points primarily to settings or accounting audit paths rather than one school-wide Admin audit workspace.

---

## 10. Major Audit Findings

### ADM-001 — P0 Critical

**Title:** Admin preset is not a full school Admin

**Evidence:** `systemRolePermissions.admin` removes all finance-root permissions.

**Impact:** Admin cannot fully operate M3, payroll, M11, or finance settings.

**Required change:** Assign all `TENANT_PERMISSION_KEYS` to `admin`.

---

### ADM-002 — P0 Critical

**Title:** Platform and school Admin personas are semantically conflated

**Evidence:** Platform roles are included in `FULL_ADMIN_ROLES`.

**Impact:** Persona resolution relies on later route checks to restore the boundary.

**Required change:** Introduce an explicit Platform persona and support-override acting context.

---

### ADM-003 — P0 High

**Title:** Unknown non-teacher users fall back to Admin persona

**Evidence:** `resolveSchoolWebPersona` returns `admin` by default.

**Impact:** Under-specified roles receive an Admin-shaped shell and dashboard attempt.

**Required change:** Fail closed to `restricted_school_user` or a purpose-limited workspace.

---

### ADM-004 — P0 High

**Title:** School Config Owner and Admin authority are fragmented

**Evidence:** `school_config_owner` resolves to Admin UI but holds a narrow permission list.

**Impact:** Two users see the same shell with materially different capabilities; neither role cleanly expresses full tenant administration plus ownership safeguards.

**Required change:** Give Admin full tenant operations; give Config Owner full Admin plus ownership/delegation safeguards.

---

### ADM-005 — P1 High

**Title:** Admin dashboard projection is incomplete

**Evidence:** Only six modules are queried for Admin.

**Impact:** Academic, activity, accounting, enabled service modules, learning, security, and configuration risk are absent.

**Required change:** Add a bounded tenant-command summary contract that covers all enabled school domains without turning the dashboard into a metric wall.

---

### ADM-006 — P1 High

**Title:** No universal Approval Centre

**Evidence:** Admin has Action Centre and notice approvals, but no cross-module approval queue.

**Impact:** Refunds, reversals, leave, attendance corrections, result publication, fiscal actions, content approval, and other decisions are scattered.

**Required change:** Add `/dashboard/approvals` with typed, permission-safe approval items.

---

### ADM-007 — P1 High

**Title:** Full school finance routes exist but are hidden from Admin

**Evidence:** Accountant and cashier navigation already expose the required route families.

**Impact:** School leadership must assign a second role or use a second account to access school finance.

**Required change:** Include finance and accounting groups in the Admin IA and preset.

---

### ADM-008 — P1 Medium

**Title:** Settings IA is too hidden for the primary school administrator

**Evidence:** The sidebar exposes one footer Settings item, while the backend provides more than twenty grouped settings destinations.

**Impact:** Discoverability and governance are poor for the persona responsible for the complete school configuration.

**Required change:** Keep one sidebar entry, but provide a strong settings control center with clear grouped navigation, readiness, recent changes, and risk levels.

---

### ADM-009 — P1 Medium

**Title:** Admin route model relies heavily on `any` permission gates

**Evidence:** Most dashboard route gates allow entry when any one permission in a broad set is present.

**Impact:** A user may open a broad page that contains controls or queries beyond the one granted capability.

**Required change:** Retain page access checks, but enforce operation-level capability checks, purpose-limited queries, and mutation guards consistently.

---

### ADM-010 — P1 Medium

**Title:** HR landing page can become permission-incoherent

**Evidence:** Staff navigation permits access through HR read, while the shared HR page also loads payroll summaries.

**Impact:** Partial failures or misleading unavailable states may occur.

**Required change:** Use persona/capability-aware sections or separate HR and Payroll landing pages.

---

### ADM-011 — P1 Medium

**Title:** School audit evidence is fragmented

**Evidence:** Settings audit, accounting audit, reports, delivery diagnostics, and module histories are separate.

**Impact:** Admin cannot answer who changed what, when, why, and with what downstream effect from one evidence workspace.

**Required change:** Add a unified tenant audit index with domain filters and protected evidence links.

---

### ADM-012 — P1 Medium

**Title:** High-risk Admin actions lack one universal interaction standard

**Examples:**

- guardian restriction changes;
- bulk attendance corrections;
- refunds and reversals;
- payroll posting;
- fiscal reopen;
- result withdrawal;
- user suspension;
- role-permission changes;
- notice withdrawal;
- protected exports.

**Required change:** Standardize reason, impact summary, step-up authentication, confirmation, optional dual approval, immutable audit event, and post-action receipt.

---

### ADM-013 — P2 Medium

**Title:** Module enablement and implementation phase are not communicated consistently

**Impact:** Enabled, disabled, deferred, unavailable, and permission-denied states can be confused.

**Required change:** Use distinct entitlement, readiness, implementation, and permission states.

---

### ADM-014 — P2 Medium

**Title:** Branch context is not first-class across the Admin workspace

**Impact:** Multi-branch schools risk operating in the wrong branch context or misreading consolidated totals.

**Required change:** Add branch scope to the global context bar and every relevant API/report contract.

---

### ADM-015 — P2 Medium

**Title:** Current Admin smoke coverage is stale and narrow

**Evidence:** `apps/web/e2e/admin-smoke.spec.ts` expects older headings and route behavior, covers only a subset of modules, and contains weak locator fallback patterns.

**Required change:** Replace with persona-contract, navigation, permission, module, high-risk action, platform-denial, and responsive E2E suites.

---

## 11. Target Admin Capability Model

### Full school operations

Admin must receive all tenant-scoped permissions for:

- admissions;
- students, guardians, enrollment, lifecycle, documents, and iEMIS;
- attendance operations, corrections, policies, and reports;
- fees, collections, receipts, adjustments, close, and reports;
- academics, exam setup, marks, results, report cards, promotion, and publication;
- activity authoring, moderation, consent, milestones, and reports;
- homework and timetable administration;
- staff, HR, leave, attendance, contracts, and payroll;
- Library, Transport, Canteen, and Learning when enabled;
- accounting, fiscal management, journals, vouchers, reconciliation, payables, and financial reporting;
- notifications, notices, delivery diagnostics, and retry workflows;
- users, roles, policies, security, integrations status, exports, and audit.

### Explicitly denied

The Admin role must have no permission matching:

```text
platform:*
tenants:manage
```

It must also have no developer-only infrastructure permission introduced in the future.

### Context boundaries

Every Admin action remains constrained by:

1. tenant;
2. branch;
3. module entitlement;
4. active academic or fiscal context;
5. record scope;
6. workflow state;
7. high-risk action policy;
8. immutable audit requirements.

Full school access is not cross-tenant access.

---

## 12. Recommended Admin Navigation

```text
Command Centre
  Dashboard
  Action Centre
  Approval Centre
  School Readiness

Students
  Admissions
  Students
  Guardians & Access
  Enrollment & Lifecycle

Daily Operations
  Attendance
  Activity Feed
  Notices
  Notifications & Delivery

Academics
  Academics
  Exams & Results
  Homework
  Timetable
  Learning                     [enabled only]

People
  HR & Staff
  Leave & Attendance
  Payroll

Finance
  Fees & Receipts
  Accounting
  Cash & Bank
  Expenses & Payables

School Services               [enabled modules only]
  Library
  Transport
  Canteen

Evidence
  Reports & Exports
  School Audit

System
  Settings
```

Sub-workspaces remain inside each module through tabs, local navigation, command palette, and deep links. The sidebar should not list every operational subroute.

---

## 13. Platform Boundary Requirements

### School Admin should see

- school module entitlement status;
- safe provider connection status;
- school-side delivery failures;
- school export job status;
- school storage/document readiness;
- support contact and escalation option.

### School Admin should not see

- provider credentials;
- secrets or tokens;
- platform API keys;
- raw global queue controls;
- other tenants;
- plan management;
- subscription billing internals;
- global usage metering;
- support override issuance;
- platform audit;
- platform infrastructure health.

### UI response to `/platform/*`

```text
Title: Platform access is restricted
Description: This account administers one school. SchoolOS Platform controls
are available only to authorized SchoolOS operators.
Primary action: Return to School Dashboard
```

The API must independently return `403` without disclosing platform data.

---

## 14. Admin Safety Model

Full Admin access increases responsibility and must strengthen controls rather than remove them.

### Required control classes

| Risk class | Examples | Required UI pattern |
|---|---|---|
| Routine | create class, publish homework, update contact | normal save with validation and audit |
| Sensitive | view salary, medical note, guardian restriction | masked default, reveal reason, audit |
| High-risk | refund, reversal, payroll post, result publish | impact summary, reason, confirmation, step-up where configured |
| Destructive/lifecycle | withdraw student, terminate staff, reopen fiscal period | typed confirmation, dual approval option, immutable receipt |
| Bulk | import, invoice generation, attendance correction | preview, validation report, partial-failure handling, downloadable result |
| Export | financial, student, payroll, audit export | reason, watermark, protected file, generation history, expiry |

### Non-negotiable behavior

- no destructive deletion of posted financial or audit records;
- no browser-computed official totals;
- no fake zero for unavailable data;
- no raw private URLs;
- no cross-tenant identifiers in school views;
- no hidden mutation triggered by navigation;
- no high-risk action without visible consequence and audit evidence.

---

## 15. Definition of Done

The Admin persona is complete only when:

- `admin` receives all tenant-scoped school permissions;
- no Platform permission is included;
- Platform roles no longer resolve as ordinary school Admins;
- unknown roles fail closed;
- all enabled modules appear in the Admin IA;
- finance, payroll, and accounting are fully accessible;
- settings exposes every school domain clearly;
- the dashboard covers school-wide readiness without excessive density;
- a universal Approval Centre exists;
- a unified school audit index exists;
- high-risk actions share one audited confirmation standard;
- branch, academic year, and fiscal context are explicit;
- entitlement-disabled modules are clearly distinguished from permission denial;
- direct `/platform/*` access is denied in frontend and backend;
- E2E coverage proves access to every enabled school domain and denial of every Platform domain;
- loading, empty, error, partial, locked, stale, offline, permission, and protected-file states are implemented consistently.

---

## 16. Audit Conclusion

SchoolOS already contains most of the individual school workspaces required for a full Admin experience. The primary gap is not absence of modules; it is **persona composition and governance**.

The current Admin is broad but intentionally non-financial. The target requested here is different:

```text
One tenant-scoped Admin account can operate the complete school.
That account still cannot operate the SchoolOS SaaS platform.
```

The implementation should therefore consolidate existing specialist capabilities into a complete Admin authority model, improve navigation and dashboard composition, and add stronger high-risk controls instead of duplicating module UIs.