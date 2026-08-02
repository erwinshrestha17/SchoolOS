# SchoolOS Admin Web Persona Design Package

This directory defines the repository-grounded audit, complete school-side feature scope, page architecture, wireframes, and implementation plan for the SchoolOS **Admin** web persona.

## Governing rule

```text
Admin has complete authority inside one SchoolOS school tenant.
Admin has no authority inside the SchoolOS Platform control plane.
```

The target Admin can configure and operate every enabled school module, including Fees, Payroll, and Accounting. Platform tenant management, SaaS plans, subscriptions, provider secrets, API keys, support overrides, global queues, infrastructure, and cross-tenant access remain developer/operator-only.

---

## Documents

| Document | Purpose |
|---|---|
| [`DESIGN.md`](./DESIGN.md) | Canonical Admin design entry point, navigation, page catalogue, boundaries, and implementation gate. |
| [`ADMIN_PERSONA_AUDIT.md`](./ADMIN_PERSONA_AUDIT.md) | Full repository audit of current permissions, persona resolution, dashboard, navigation, module availability, risks, and required corrections. |
| [`ADMIN_FEATURE_MATRIX.md`](./ADMIN_FEATURE_MATRIX.md) | Current-versus-target matrix covering M0–M13, M15, settings, reports, audit, and Platform-only functions. |
| [`ADMIN_WEB_DESIGN.md`](./ADMIN_WEB_DESIGN.md) | Detailed UX specification for 63 Admin page-level surfaces. |
| [`ADMIN_WEB_WIREFRAMES.md`](./ADMIN_WEB_WIREFRAMES.md) | Low-fidelity page, state, responsive, high-risk action, and Platform-denial wireframes. |
| [`ADMIN_WEB_IMPLEMENTATION_SPEC.md`](./ADMIN_WEB_IMPLEMENTATION_SPEC.md) | Authorization, navigation, API, component, migration, test, delivery-slice, and acceptance requirements. |

---

## Critical audit findings

1. The current `admin` preset deliberately excludes Fees, Payments, Receipts, Ledger, Payroll, Accounting, Finance, and finance/accounting settings.
2. Platform roles currently resolve through the same school-web Admin persona before later route restrictions restore the boundary.
3. Unknown non-teacher roles currently fall back to the Admin persona rather than failing closed.
4. The Admin dashboard currently projects only six module families and does not represent the complete school remit.
5. Finance, payroll, and accounting workspaces already exist, but the Admin preset normally hides them.
6. School settings are comprehensive but are compressed behind one generic navigation entry and finance domains are excluded from the current Admin role.
7. Approval evidence, tenant audit evidence, and high-risk interaction patterns remain fragmented across modules.
8. Existing Admin E2E smoke coverage is narrow and partly stale.

---

## Target Admin permission model

```text
Admin
  every tenant-scoped SchoolOS permission
  no platform:* permission
  no tenants:manage
  no removed chat-write permission
  no future developer-only permission family

School Configuration Owner
  every Admin permission
  settings delegation
  ownership continuity safeguards
```

Full Admin access must not be implemented by removing authorization checks. Backend permissions, tenant isolation, branch scope, module entitlements, workflow state, high-risk controls, and immutable audit remain mandatory.

---

## Target navigation

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

School Services               [enabled only]
  Library
  Transport
  Canteen

Evidence
  Reports & Exports
  School Audit

System
  Settings
```

---

## Active scope

### Included

- complete school-side M0 configuration;
- M1 through M13 and M15 when enabled and released;
- users, roles, permissions, policies, settings, reports, exports, and tenant audit;
- full M3 Fees and Receipts;
- full M7 HR and Payroll;
- full M11 Accounting and Finance.

### Conditional

- M8 Library;
- M9 Transport;
- M10 Canteen;
- M13 Learning.

These remain entitlement- and release-gated. Admin cannot bypass Platform-owned module enablement.

### Excluded

- M14 Intelligence / AI runtime;
- removed open chat;
- every `/platform/*` function;
- cross-tenant and developer operations.

---

## Page coverage

The design package specifies 63 page-level surfaces grouped into:

- Command Centre;
- Students and Admissions;
- Attendance;
- Fees and Receipts;
- Academics;
- Activity, Homework, Timetable, and Learning;
- People and Payroll;
- School Services;
- Accounting and Finance;
- Communication;
- Reports, Audit, Settings, and Personal Account.

Each page specification defines its main job, header, summary, filters, work surface, detail or evidence panel, safe actions, high-risk controls, responsive behavior, and required states.

---

## First implementation sequence

```text
ADM-P0-01  Full tenant Admin permission preset
ADM-P0-02  School persona and Platform separation
ADM-P0-03  Complete Admin navigation
ADM-P0-04  Shared high-risk action standard
ADM-P1-01  Complete Admin Command Centre
ADM-P1-02  Universal Approval Centre
ADM-P1-03  School Readiness and global context
ADM-P1-04  Unified School Audit
ADM-P1-05  Complete Settings governance
ADM-P1-06  Replace stale Admin E2E coverage
```

---

## Completion gate

The Admin persona is not complete until:

- all tenant-scoped school permission families are included;
- finance, payroll, accounting, and settings are available;
- Platform and school personas are separated by construction;
- unknown roles fail closed;
- every enabled school module is discoverable;
- every high-risk action is impact-aware and audited;
- Platform routes and APIs are denied;
- no Platform permission is assignable from school settings;
- the complete Admin route, module, accessibility, responsive, and high-risk test matrix passes.