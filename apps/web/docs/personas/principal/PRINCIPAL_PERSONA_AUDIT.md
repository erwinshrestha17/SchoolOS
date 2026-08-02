# SchoolOS Principal Web Persona — Full Audit

**Status:** Design and authorization audit  
**Scope:** `apps/web` Principal persona, current `main` branch baseline  
**Product boundary:** Nepal-scoped SchoolOS; controlled-pilot / P0-first roadmap  
**Terminology:** The correct role name is **Principal**. “Principle” is not used in product copy.

---

## 1. Audit objective

This audit answers four questions:

1. What Principal-specific web functionality is implemented now?
2. Which shared pages expose operational actions that do not belong to a Principal?
3. What should the Principal web information architecture become?
4. Which authorization, route, API, and design changes are required before the Principal surface can be treated as safe and complete?

The intended Principal persona is a leadership user who primarily:

- Monitors school-wide readiness.
- Reviews exceptions and risk.
- Makes designated approval decisions.
- Escalates unresolved operational issues.
- Reviews academic, attendance, staff, communication, and financial summaries.
- Opens reports and high-risk audit evidence.

The Principal is **not** a substitute Admin, Accountant, HR operator, Examination Coordinator, or classroom Teacher.

---

## 2. Evidence inspected

### Persona and authorization

- `packages/core/src/school-web-persona.ts`
- `packages/core/src/dashboard-persona.ts`
- `packages/core/src/permissions/roles.ts`
- `apps/web/lib/school-web-persona.ts`
- `apps/web/components/layout/sidebar-persona-nav.config.ts`

### Dashboard and shell

- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/dashboard/principal-dashboard.tsx`
- `apps/web/components/dashboard/operational-dashboard-layout.tsx`
- `apps/web/components/dashboard/dashboard-summary-strip.tsx`
- `apps/web/components/dashboard/dashboard-attention-panel.tsx`
- `apps/web/components/dashboard/dashboard-operations-panel.tsx`
- `apps/web/components/layout/sidebar.tsx`

### Shared module pages reached by the Principal navigation

- `apps/web/app/dashboard/students/page.tsx`
- `apps/web/app/dashboard/admissions/page.tsx`
- `apps/web/app/dashboard/attendance/page.tsx`
- `apps/web/components/attendance/attendance-m2-workspaces.tsx`
- `apps/web/app/dashboard/academics/page.tsx`
- `apps/web/app/dashboard/hr/page.tsx`
- `apps/web/app/dashboard/accounting/page.tsx`
- `apps/web/components/accounting/accounting-dashboard-view.tsx`
- `apps/web/app/dashboard/operations/page.tsx`
- `apps/web/app/dashboard/notices/approvals/page.tsx`
- `apps/web/components/notices/notice-queue-workspace.tsx`
- `apps/web/app/dashboard/activity/page.tsx`
- `apps/web/app/dashboard/reports/page.tsx`

### Design and product rules

- `apps/web/AGENTS.md`
- `apps/web/docs/DESIGN_SYSTEM.md`
- `docs/Persona/SchoolOS_Module_Features_and_Persona_Platform_Mapping.md`
- `docs/SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md`

---

## 3. Executive verdict

The Principal web surface is **partially implemented but not yet persona-safe**.

### What is strong

- Principal persona resolution exists.
- A Principal-specific sidebar tree exists.
- The executive dashboard title, description, and composition are persona-specific.
- Dashboard data projection is server-aligned and client-validated.
- Principal dashboard module selection includes communications, attendance, academics, fees, and HR.
- Attention items and next actions are filtered for leadership relevance.
- Accounting write actions are generally permission-gated.
- Personal settings are intentionally kept out of the institutional Settings sidebar.

### What is unsafe or incomplete

- The canonical `principal` role is defined as nearly all tenant permissions minus a limited exclusion list.
- Principal users can inherit operational write permissions unrelated to leadership oversight.
- Several Principal sidebar entries open shared Admin, HR, Accountant, Teacher, or module-operator workspaces.
- Page headers often advertise actions the Principal should not perform.
- The Principal dashboard receives finance and staff modules, but the top summary strip explicitly omits finance and staff for the Principal persona.
- “Attention Items” is only a dashboard hash anchor, not a durable queue workspace.
- “Approvals” is notice-only; there is no cross-module approval centre.
- “Audit” routes into accounting audit rather than a school-wide leadership audit view.
- Deferred M8 Library, M9 Transport, and M10 Canteen surfaces remain reachable through the Principal navigation and broad Principal permissions.

**Audit result:** `PARTIAL — authorization and persona-composition redesign required`.

---

## 4. Current Principal navigation

The current navigation is defined in `principalNavGroups`.

```text
Leadership
  Executive Dashboard
  Attention Items
  Approvals

Students and Admissions
  Students
  Admissions

Oversight
  Attendance
  Finance Overview
  Academic Readiness
  Staff Overview
  Operations

Communication
  Notices
  Activity Feed
  Notifications

Reports and Audit
  Reports
  Audit
```

This is directionally correct, but several labels are attached to operational pages rather than true oversight pages.

---

## 5. Current feature availability matrix

| Area | Current route | Current implementation | Principal audit result |
|---|---|---|---|
| Executive Dashboard | `/dashboard` | Persona-specific dashboard composition with attention, operations, readiness, and recent activity | **Keep and improve** |
| Attention Items | `/dashboard#needs-attention` | In-page bounded list; no filters, ownership, history, or dedicated URL state | **Insufficient** |
| Approvals | `/dashboard/notices/approvals` | Notice approval queue only | **Too narrow** |
| Students | `/dashboard/students` | Full student directory plus new admission, document issues, duplicates, iEMIS export, QR/ID, roster export | **Over-privileged** |
| Admissions | `/dashboard/admissions` | Operational admission queues plus new admission, assessments, duplicate review, iEMIS, QR/ID, policy link | **Over-privileged** |
| Attendance | `/dashboard/attendance` | School overview, Mark Attendance CTA, bulk actions, offline drafts, anomalies, corrections, reports, settings | **Mixed oversight and write operations** |
| Finance Overview | `/dashboard/accounting` | Accountant-oriented M11 dashboard; reports plus fiscal management and accounting workflow links | **Wrong information architecture** |
| Academic Readiness | `/dashboard/academics` | Exam setup, marks entry, report cards, publishing, lock review, retests, promotion | **Over-privileged** |
| Staff Overview | `/dashboard/hr` | HR + payroll operations, Add Staff, leave queue, contract management, payroll tabs | **Over-privileged and internally inconsistent** |
| Operations | `/dashboard/operations` | Library, Transport, and Canteen overview with links to issue/return, live trips, and POS | **Outside active P0 scope** |
| Notices | `/dashboard/notices` | Notice authoring and operational lifecycle workspace | **Needs leadership composition** |
| Activity Feed | `/dashboard/activity` | Create Activity, feed operations, gallery, milestones, deliveries, moderation | **Over-privileged** |
| Notifications | `/dashboard/notifications` | Personal notifications and relevant delivery state | **Generally appropriate** |
| Reports | `/dashboard/reports` | Generic report catalogue and export workspace | **Keep, curate for Principal** |
| Audit | `/dashboard/accounting/audit` | Accounting audit trail | **Too narrow and finance-centric** |
| Profile / Security | Header user menu | Personal profile, notifications, and security routes | **Appropriate** |

---

## 6. Critical authorization findings

### PPR-001 — Principal role inherits broad tenant operations

**Severity:** P0 Critical  
**Source:** `packages/core/src/permissions/roles.ts`

The Principal role is currently created with:

```text
TENANT_PERMISSION_KEYS
minus PRINCIPAL_EXCLUDED_KEYS
```

The exclusion list removes many finance, payroll, and settings operations, but leaves broad operational permissions in other modules.

Likely inherited capabilities include, subject to the permission catalogue:

- Student creation and lifecycle operations.
- Guardian and enrollment operations.
- Attendance marking and attendance corrections.
- Academic configuration and marks entry.
- Activity creation and broad activity operations.
- HR staff creation and management.
- Library, Transport, and Canteen operations.

**Required decision:** Replace “all tenant permissions minus exclusions” with an explicit Principal allowlist.

---

### PPR-002 — Student and admission pages are Admin-shaped

**Severity:** P0 High

The Student page can show:

- `New admission`.
- Document-issue operations.
- Duplicate resolution.
- iEMIS export.
- QR / ID card operations.
- Directory export.

The Admissions page can show:

- `New admission`.
- Online application operations.
- Assessment and interview operations.
- Duplicate review.
- iEMIS readiness and import work.
- Admission policy navigation.

These are not standard Principal daily jobs. The Principal should see:

- Admission funnel.
- Capacity and waitlist.
- Cases requiring leadership review.
- Sensitive exceptions.
- Transfer and withdrawal approvals where policy requires.
- Enrollment and data-quality summaries.

---

### PPR-003 — Attendance overview exposes marking operations

**Severity:** P0 Critical

The shared attendance overview displays:

- `Mark Attendance` as the primary action.
- Bulk actions.
- Offline drafts.
- Attendance settings.
- Operational class-session tables.

The Principal should not mark routine attendance. The Principal page should instead prioritize:

- Classes not submitted.
- Attendance completion.
- Repeated absence and lateness anomalies.
- Early-departure and safety exceptions.
- Pending correction and reopen decisions.
- Teacher submission compliance.

---

### PPR-004 — Academic readiness opens academic authoring

**Severity:** P0 Critical

The shared Academics page may offer:

- Create Exam Term.
- Enter Marks.
- Assessment component setup.
- Retest operations.
- Marks lock operations.
- Promotion operations.

The Principal should receive:

- Exam readiness.
- Missing marks and delayed submission.
- Result approval.
- Publication authorization.
- Result withdrawal approval.
- Correction / unlock oversight.
- Promotion review.
- Report-card generation failures.

Routine marks entry and exam configuration belong to Teachers, Examination Coordinators, or Admin.

---

### PPR-005 — Staff Overview is an HR operations page

**Severity:** P0 High

The current HR page includes:

- `Add Staff`.
- Staff, contract, leave, attendance, payroll, readiness, payslip, and report tabs.
- Payroll API queries.
- Leave and contract operations.

The Principal preset explicitly excludes payroll permissions, yet the shared page still presents payroll-oriented composition. This creates inaccessible tabs, partial errors, and role confusion.

The Principal should see:

- Staff headcount.
- Attendance anomalies.
- Approved leave and coverage impact.
- Contracts expiring.
- Vacancies and critical staffing gaps.
- Payroll readiness status only when explicitly authorized.
- Designated leave / payroll approval actions only.

---

### PPR-006 — Finance Overview is accountant-shaped

**Severity:** P1 High

The current Principal route opens the general Accounting dashboard. Although journal creation is permission-gated, the screen still uses accountant-centric navigation and links such as:

- Fiscal management.
- Journal queues.
- Reconciliation.
- Source mappings.
- Detailed ledger postings.

The Principal needs a separate read-only financial oversight view:

- Collection and outstanding summary.
- Cash and bank position.
- Income and expenditure trend.
- Budget versus actual when implemented.
- Reconciliation exceptions.
- Large adjustments, refunds, reversals, or unusual vouchers awaiting approval.
- Financial statement links.

No journal entry, account setup, source mapping, or routine reconciliation controls should appear.

---

### PPR-007 — Operations exposes deferred modules

**Severity:** P0 Scope Violation

The current Operations page aggregates:

- M8 Library.
- M9 Transport.
- M10 Canteen.

These modules are currently deferred and should not occupy Principal navigation or design priority during the active P0 scope.

**Required decision:** Hide the Operations group for the current roadmap. Reintroduce a read-only Principal operations view only when the corresponding modules are reactivated.

---

### PPR-008 — Communication pages remain author/operator-first

**Severity:** P1 Medium

The Principal can open authoring-first pages such as:

- `Create notice` on the notice approval queue.
- `Create Activity` on the Activity Feed page.

Leadership pages should be queue- and decision-first:

- Pending approval.
- Audience impact.
- Sensitive content.
- Consent exceptions.
- Delivery failures.
- Unacknowledged critical notices.
- Reported content.

Authoring can remain available as a secondary action when explicitly permitted.

---

### PPR-009 — No cross-module approval centre

**Severity:** P0 High

The Principal navigation label `Approvals` currently routes only to notice approvals.

A real Principal approval centre should aggregate only designated, server-authorized approval items such as:

- Attendance correction or reopen.
- Result publication / withdrawal.
- Marks unlock or correction.
- Sensitive admission exception.
- Staff leave escalation.
- High-impact notice approval.
- Large refund / reversal / voucher approval when finance delegation exists.

Every approval row needs:

- Type.
- Submitted by.
- Submitted at.
- Impact scope.
- Evidence completeness.
- SLA / age.
- Current approval step.
- Safe drill-down.

---

### PPR-010 — Audit is accounting-only

**Severity:** P1 High

The Principal needs a school leadership audit view, not only an M11 accounting audit trail.

High-risk audit categories should include:

- Role and permission changes.
- Guardian access changes.
- Student lifecycle changes.
- Attendance reopen/correction.
- Marks unlock/correction.
- Result publish/withdraw.
- Fee refund/reversal.
- Payroll approval/posting where authorized.
- Notice publish/withdraw.
- Protected export generation.
- Sensitive record access.

---

### PPR-011 — Dashboard top strip omits finance and staff for Principal

**Severity:** P1 Medium

`PRINCIPAL_DASHBOARD_MODULES` includes M3 Fees and M7 HR/Payroll. However, `dashboard-summary-strip.tsx` currently sets:

```text
includeFees = admin or accountant
includeStaff = admin or hr
```

Therefore the Principal top strip cannot show the intended leadership finance and staff summaries even when the server projection contains those modules.

**Required change:** Add Principal-safe finance and staff KPI models sourced from read-only, bounded backend summaries.

---

## 7. Target Principal capability model

The Principal preset should use an explicit allowlist grouped by purpose.

### Oversight read

- School-wide student and enrollment summary.
- Admission summary and exception queue.
- Attendance summary, anomalies, and correction queue.
- Academic readiness, results, publication, and correction queue.
- Staff summary, leave impact, contract reminders, and workforce reports.
- Read-only finance summaries and financial reports.
- Notice, delivery, activity moderation, and critical communication summary.
- Reports and high-risk audit events.

### Designated decisions

- Approve or reject configured admission exceptions.
- Approve attendance reopen/correction.
- Approve marks unlock / result publish / result withdrawal.
- Approve designated leave escalations.
- Approve high-impact notices.
- Approve designated finance exceptions only when separately delegated.

### Explicitly excluded by default

- Create or edit routine student records.
- Create routine admissions.
- Mark attendance.
- Enter marks.
- Configure exams, grading, timetable, or school settings.
- Create or modify staff records.
- Run payroll.
- Create journals or vouchers.
- Collect payments.
- Reconcile bank accounts.
- Operate Library, Transport, or Canteen.
- Configure providers, queues, or platform settings.

---

## 8. Recommended Principal navigation

### Active P0/P1 navigation

```text
Leadership
  Executive Dashboard
  Attention Centre
  Approval Centre

Students
  Enrollment Overview
  Admissions Overview

School Readiness
  Attendance Oversight
  Academic Readiness
  Staff Overview
  Finance Overview

Communication
  Notices
  Activity Oversight
  Notifications

Evidence
  Reports
  Leadership Audit
```

### Personal routes

Remain in the header user menu:

```text
My Profile
Notification Preferences
Security and Sessions
Sign Out
```

### Deferred navigation

Do not show during current P0 scope:

```text
Library
Transport
Canteen
Learning Layer
Open chat / conversations
```

---

## 9. Page inventory for the design package

The companion design documents specify these pages:

1. Executive Dashboard.
2. Attention Centre.
3. Approval Centre.
4. Enrollment Overview.
5. Admissions Overview.
6. Attendance Oversight.
7. Academic Readiness.
8. Staff Overview.
9. Finance Overview.
10. Notices and critical communication.
11. Activity Oversight.
12. Notifications.
13. Reports.
14. Leadership Audit.
15. Personal Profile and Security entry points.

See:

- `PRINCIPAL_WEB_DESIGN.md`
- `PRINCIPAL_WEB_WIREFRAMES.md`
- `PRINCIPAL_WEB_IMPLEMENTATION_SPEC.md`

---

## 10. Definition of done for Principal web safety

The Principal web surface is complete only when:

- The Principal role uses an explicit permission allowlist.
- No routine operational write appears solely because the user has the Principal role.
- Every page renders a Principal-specific composition or a genuinely shared read-only composition.
- Cross-module attention and approval queues are server-projected.
- Finance, staff, attendance, and academics use leadership summaries rather than operator workspaces.
- Deferred modules are absent from navigation and route recommendations.
- Every forbidden action is blocked at API and service layers, not only hidden in the UI.
- Direct URL access to Admin/Teacher/HR/Accountant write routes is denied.
- Principal-specific authorization and route tests pass.
- Empty, loading, error, permission-denied, partial-data, and stale-data states are implemented.
- Reports and protected files remain permission-scoped and audited.
