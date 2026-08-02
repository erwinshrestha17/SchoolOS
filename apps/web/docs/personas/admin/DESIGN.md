# SchoolOS Admin Web Design

**Canonical design entry point**  
**Persona:** School Admin  
**Surface:** School web application  
**Route plane:** `/dashboard/*` and `/dashboard/settings/*`  
**Platform access:** None

---

## 1. Product Definition

The School Admin is the highest-authority operator inside one SchoolOS tenant.

```text
Admin owns the complete school workspace.
Platform owns the SchoolOS service and developer control plane.
```

The Admin must be able to configure and operate every school capability required by the tenant, including:

- school setup and security;
- users, roles, and permissions;
- admissions and student lifecycle;
- attendance;
- fees, collections, receipts, refunds, and cashier close;
- academics, exams, marks, results, and report cards;
- activity feed and consent-aware media;
- homework and timetable;
- HR, staff attendance, leave, and payroll;
- accounting, reconciliation, journals, expenses, and financial reports;
- notices, notifications, delivery diagnostics, and acknowledgements;
- Library, Transport, Canteen, and Learning when enabled;
- reports, protected exports, approvals, and tenant audit evidence.

The Admin must never receive:

- cross-tenant access;
- tenant provisioning or suspension;
- SaaS plan or subscription management;
- Platform billing;
- provider secrets or API keys;
- support-override issuance;
- global queue or infrastructure controls;
- Platform audit or health access;
- any `/platform/*` workspace.

---

## 2. Required Authorization Result

```text
Admin permissions
= every tenant-scoped SchoolOS permission
- platform:*
- tenants:manage
- removed chat-write permissions
- future developer-only permission families
```

Full access must be implemented through explicit tenant-scoped permissions and backend authorization. It must not be implemented by disabling guards.

`school_config_owner` should receive full Admin authority plus ownership continuity and delegation safeguards.

Unknown or under-specified school roles must fail closed instead of receiving an Admin-shaped shell.

---

## 3. Target Navigation

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

The sidebar exposes module hubs rather than every subroute. Detailed workflows belong to module tabs, tables, drawers, command palette entries, and context-aware deep links.

---

## 4. Global Page Structure

Every Admin page follows this hierarchy where relevant:

```text
Authenticated School Shell
  Topbar
    School and branch context
    Academic year or fiscal period
    Global search
    Notifications
    User menu

  Sidebar
    Persona-safe school navigation

  Page
    Breadcrumb or module label
    ModuleHeader
    Context and filters
    Decision-useful summary
    Primary work surface
    Detail drawer or evidence rail
    Sticky action bar only for review or multi-step work
```

### Required page rules

- One page has one main job.
- One primary action appears in the page header.
- Secondary actions appear under `More Actions`.
- Growing lists use server filtering and pagination.
- Official attendance, marks, money, payroll, and accounting totals come from backend responses.
- Unavailable data is never presented as zero.
- Private files use authenticated File Registry helpers.
- High-risk actions show impact, require reason, and return audit evidence.
- Platform controls never appear in school navigation, search, or settings.

---

## 5. Page Catalogue

The detailed design defines **63 page-level surfaces**.

### Command Centre

1. Admin Dashboard
2. Action Centre
3. Approval Centre
4. School Readiness

### Students and Admissions

5. Admissions Overview
6. Admission Case Detail
7. Students Directory
8. Student Profile
9. Guardians and Access
10. Enrollment and Lifecycle
11. Documents, Data Quality, and iEMIS

### Attendance

12. Attendance Overview
13. Attendance Marking and Registers
14. Attendance Corrections, Conflicts, and Anomalies
15. Attendance Reports

### Fees and Receipts

16. Fees Overview
17. Billing Runs and Invoices
18. Collection Counter
19. Student Ledger and Receipt Centre
20. Adjustments, Refunds, Reversals, and Waivers
21. Cashier Close
22. Fees Reports and Setup

### Academics

23. Academics Overview
24. Academic Structure and Teacher Assignments
25. Exam Setup
26. Marks and CAS
27. Results and Publication
28. Report Cards, Promotion, Retakes, and Locks

### Activity, Homework, Timetable, and Learning

29. Activity Feed
30. Activity Composer
31. Moderation, Consent, Milestones, and Reports
32. Homework Overview
33. Homework Editor and Review
34. Timetable Overview
35. Timetable Builder and Exceptions
55. Learning Overview
56. Learning Activity, Session, Attempts, and Progress

### People and Payroll

36. HR Dashboard
37. Staff Directory and Profile
38. Contracts, Leave, and Staff Attendance
39. Payroll Runs
40. Payslips and Payroll Reports

### School Services

41. School Operations Hub
42. Library Workspace
43. Transport Workspace
44. Canteen Workspace

### Accounting and Finance

45. Finance and Accounting Dashboard
46. Chart of Accounts and Fiscal Management
47. Journals and Vouchers
48. Cash, Bank, and Reconciliation
49. Receivables, Payables, Expenses, and Source Postings
50. Financial Reports and Accounting Audit

### Communication

51. Notices Centre
52. Notice Composer and Lifecycle Detail
53. Delivery and Failure Centre
54. Notifications Inbox

### Evidence and Governance

57. Reports and Exports
58. School Audit
59. Settings Overview
60. School Identity, Branding, Calendar, and Structure
61. Policies, Modules, Integrations, and Documents
62. Users, Roles, Permissions, and Security
63. Personal Account

The non-sequential Learning numbering preserves the full grouped catalogue used by the detailed design and wireframe documents.

---

## 6. High-Risk Interaction Standard

Every high-risk action follows this sequence:

```text
1. Review the current record
2. Review the proposed change and downstream impact
3. Provide a reason and supporting evidence
4. Confirm or complete step-up authentication
5. Receive an immutable result and audit reference
```

Examples include:

- student withdrawal or transfer;
- guardian restriction;
- attendance correction or lock override;
- refund, reversal, waiver, or cashier reopen;
- result publication or withdrawal;
- timetable publication;
- staff termination;
- payroll posting or reversal;
- journal posting or reversal;
- fiscal period reopening;
- notice withdrawal;
- risky role changes;
- sensitive exports.

Posted financial, audit, attendance correction, and result-history records must never be destructively deleted.

---

## 7. Entitlement and Release States

Full Admin authority applies only inside enabled school modules.

### Core modules

The Admin can always reach entitled core school operations.

### Conditional modules

- M8 Library
- M9 Transport
- M10 Canteen
- M13 Learning

These remain entitlement-gated and release-gated where required.

### State language

- `Permission denied` — the session lacks a school capability.
- `Module not enabled` — the school entitlement does not include the module.
- `Setup required` — the module is enabled but not configured.
- `Temporarily unavailable` — the backend or provider cannot return current data.
- `Deferred` — the module is outside the active release phase.

These states must not be conflated.

---

## 8. Platform-Denied Experience

A school Admin opening `/platform/*` receives only:

```text
Platform access is restricted

This account administers one school. SchoolOS Platform controls are available
only to authorized SchoolOS operators.

[Return to School Dashboard]
```

No Platform sidebar, tenant list, provider status, queue, plan, billing, API key, support, health, or audit data may render.

---

## 9. Detailed Design Documents

Use these documents together:

| Document | Purpose |
|---|---|
| [`ADMIN_PERSONA_AUDIT.md`](./ADMIN_PERSONA_AUDIT.md) | Repository-grounded audit, current availability, permission defects, findings, and target Admin model. |
| [`ADMIN_FEATURE_MATRIX.md`](./ADMIN_FEATURE_MATRIX.md) | Module-by-module feature, route, settings, report, and Platform-boundary matrix. |
| [`ADMIN_WEB_DESIGN.md`](./ADMIN_WEB_DESIGN.md) | Full page-by-page UX specification for all 63 surfaces. |
| [`ADMIN_WEB_WIREFRAMES.md`](./ADMIN_WEB_WIREFRAMES.md) | Desktop, narrow, state, high-risk, and Platform-denied low-fidelity wireframes. |
| [`ADMIN_WEB_IMPLEMENTATION_SPEC.md`](./ADMIN_WEB_IMPLEMENTATION_SPEC.md) | Authorization, routing, API, component, testing, migration, and delivery requirements. |

---

## 10. Implementation Gate

The Admin design must not be treated as implemented until all of these are true:

- the Admin preset includes all tenant-scoped school permissions;
- finance, payroll, accounting, and related settings are available;
- Platform roles are separated from school persona resolution;
- unknown roles fail closed;
- Admin navigation covers every enabled school domain;
- the dashboard represents all enabled domains through bounded summaries;
- universal Approval Centre and School Audit workspaces exist;
- high-risk actions enforce impact, reason, confirmation, and audit;
- `/platform/*` is denied in both web and API;
- no Platform permission is assignable from School Settings;
- module, persona, responsive, accessibility, and high-risk E2E suites pass.

---

## 11. Final Design Principle

```text
Give the Admin complete control of the school.
Keep the SchoolOS Platform completely separate.
Organize authority into focused workspaces.
Make sensitive and high-risk actions controlled, visible, and auditable.
```