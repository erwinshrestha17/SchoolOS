# SchoolOS UI/UX Guide

**Last updated:** 2026-06-02

This is the active UI/UX source of truth for the SchoolOS web admin, platform control plane, mobile companion app, and future public website.

It replaces these older active UI docs:

```text
docs/design/SCHOOLOS_FINAL_UI_UX_DIRECTION.md
docs/design/SCHOOLOS_PLATFORM_UI_UX_OPTIMIZATION_PLAN.md
docs/design/SCHOOLOS_PLATFORM_UI_REDO_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_CURRENT_UI_PROGRESS.md
```

Do not recreate those separate docs unless the project grows enough to justify splitting them again.

---

## 1. Core Principle

```text
One screen = one main job.
```

Every screen must answer:

```text
What is the user trying to finish here?
```

Anything that does not support that job should move to a secondary tab, details page, report page, action menu, or separate route.

SchoolOS must feel like a modern, trustworthy, Nepal-ready school operating system. It should not feel like a complicated ERP or a generic CRUD dashboard.

---

## 2. Product Experience Goals

SchoolOS UI/UX must be:

- **Simple:** common tasks should be reachable in 1-3 clicks/taps.
- **Role-aware:** admins, teachers, accountants, admission staff, principals, parents, students, drivers, and platform operators should only see what they need.
- **Trustworthy:** finance, attendance, student records, medical data, documents, communication, and accounting actions must feel secure and auditable.
- **School-friendly:** labels, navigation, icons, and workflows must match real school operations.
- **Desktop-first for school operations:** admin, finance, attendance, reports, HR, and accounting workflows need tables, filters, exports, and approval flows.
- **Mobile-first for parents, teachers, students, and drivers:** mobile screens should be card-based, quick-action focused, and not table-heavy.
- **Nepal-ready:** support NPR, class/section conventions, guardian structures, Nepali phone patterns, receipt printing, local payment labels, and future Bikram Sambat support.
- **Safe for children:** student and parent experiences must be scoped, controlled, age-aware, and privacy-preserving.

---

## 3. Experience Families

### Public Website

Target: future public pages in `apps/web`.

Purpose:

- Explain SchoolOS modules.
- Show trust, security, and Nepal readiness.
- Support demo requests and onboarding inquiries.
- Provide SEO-friendly public pages.

Rules:

- Keep marketing/public UI separate from internal dashboard UI.
- Do not expose tenant operations.
- Use product storytelling, screenshots, school outcomes, and simple CTAs.

### School Web Dashboard

Current app: `apps/web` Next.js dashboard.

Purpose:

- Run daily school operations.
- Manage students, attendance, fees, communication, academics, HR, accounting, library, transport, and canteen.
- Support reports, exports, approvals, and audit-friendly operations.

Rules:

- Consume real APIs.
- Do not use fake production data.
- Preserve cookie-first auth behavior.
- Keep tenant-owned workflows tenant-scoped by backend APIs.
- Keep school operations under `/dashboard/*`.

### Platform Control Plane

Route target: `/platform/*`.

Purpose:

- Manage schools/tenants.
- Manage plans, limits, SaaS billing, support access, provider readiness, queue health, and platform audit logs.

Rules:

- Must be visually and functionally separate from tenant school operations.
- Platform users are not school staff.
- Platform access must be explicit, permission-guarded, and audited.
- Never mix M0 SaaS invoices/payments with M3 student fees or M9 school ledger screens.

### Mobile Companion App

Current target: `apps/schoolos_mobile` Flutter app.

Purpose:

- Provide quick answers and quick actions.
- Avoid dense dashboards and complex tables.
- Give role-specific parent, student, teacher, staff, driver, and admin flows.

Rules:

- Mobile should not be a mini web-admin dashboard.
- Use cards, timelines, bottom navigation, simple lists, and action buttons.
- Parents see only their own child/children.
- Drivers see only assigned transport data.
- Students get age-appropriate access only.

---

## 4. Visual Language

Recommended style:

- Primary color: deep blue / indigo.
- Secondary accents: purple, amber, green, cyan.
- Background: soft blue-grey / light slate.
- Cards: white, rounded, lightly bordered.
- Radius: 16px-24px for cards; 10px-14px for controls.
- Shadows: soft and minimal.
- Icons: rounded education-style line icons.
- Spacing: generous, especially on dashboards and mobile.
- Typography: clear, high contrast, and readable.

Recommended design tokens:

```ts
primary: '#155EEF'
primaryDark: '#0B3A88'
primarySoft: '#EAF1FF'
secondary: '#7C3AED'
secondarySoft: '#F3E8FF'
background: '#F3F7FB'
surface: '#FFFFFF'
border: '#E2E8F0'
success: '#16A34A'
successSoft: '#DCFCE7'
warning: '#F59E0B'
warningSoft: '#FEF3C7'
danger: '#EF4444'
dangerSoft: '#FEE2E2'
info: '#0284C7'
infoSoft: '#E0F2FE'
textPrimary: '#0F172A'
textSecondary: '#475569'
textMuted: '#94A3B8'
```

Typography:

- Page title: 28px-32px / bold.
- Section title: 18px-22px / semibold.
- Card number: 26px-34px / bold.
- Body text: 14px-16px.
- Helper text: 12px-13px.
- Button text: 14px-15px / semibold.

Rules:

- Use strong contrast.
- Avoid very light grey text for important information.
- Use short labels on mobile.
- Use descriptive headings on web admin screens.

---

## 5. Global Layout Rules

Every web admin page should follow this structure:

```text
Topbar
Left Sidebar
Page Header
Summary Cards
Main Work Area
Optional Right Insight Panel
Bottom or Sticky Action Bar only when needed
```

### Topbar

The topbar should include:

- School selector.
- Global search.
- Notification bell.
- User profile menu.
- Academic year/date context where relevant.

Global search should support student name, admission number, guardian phone, invoice number, receipt number, staff name, book/barcode, vehicle number, and notice title.

### Sidebar

Do not show technical phase labels like Phase 1, Phase 2, or Phase 3 in user-facing navigation.

Recommended school operations sidebar:

```text
Dashboard
Students
Admissions
Attendance
Fees
Communications
Activity Feed
Exams, CAS & Reports
Homework & Timetable
HR & Payroll
Accounting
Library
Transport
Canteen
Reports
Settings
```

Rules:

- Active route highlighting.
- Collapsible/toggleable sidebar.
- Clear icons.
- No phase labels.
- Permission-hidden items should not appear for users without access.
- Platform pages must remain outside normal school operations navigation.

### Page Header

Every module page should start with:

```text
Title
Short description
Primary action
Optional secondary action menu
```

Avoid placing 4-6 equal-weight buttons in the header. Secondary actions go inside `More Actions`.

---

## 6. Platform UI Rules

The M0 Platform Control Plane is for SchoolOS operators, not school staff.

Route map:

| Route | Screen job | Primary action |
|---|---|---|
| `/platform/dashboard` | Show what needs platform attention today | View schools or attention items |
| `/platform/schools` | Find and manage school tenants | Onboard new school |
| `/platform/schools/[tenantId]` | Understand and safely manage one school | Open support access or view billing |
| `/platform/billing/subscriptions` | Manage school subscriptions | Select school subscription |
| `/platform/billing/invoices` | Track SchoolOS SaaS invoices | View unpaid invoices |
| `/platform/billing/payments` | Review SchoolOS SaaS payment records | View recent payments |
| `/platform/settings/plans` | Configure SaaS plans and limits | Review plans |
| `/platform/settings/providers` | Configure and verify providers | Run readiness check |
| `/platform/operations/health` | Check infrastructure readiness | Open health details |
| `/platform/operations/queues` | Diagnose and retry failed jobs safely | Inspect failed jobs |
| `/platform/operations/audit` | Answer who did what, when, and why | Filter audit logs |
| `/platform/operations/reports` | Review generated platform reports | View report history |

Dangerous platform actions include suspending/reactivating tenants, opening support override, retrying failed jobs, discarding failed jobs, changing active plan rules, cancelling SaaS invoices, and rotating/disabling provider secrets.

Every dangerous platform action must include:

- Confirmation.
- Reason field.
- Clear warning.
- Permission check.
- Audit log expectation.

---

## 7. UX Rules for Non-Technical Users

Use school language.

Bad:

```text
Entity
Mutation failed
Workflow state
403 Forbidden
Posting exception
```

Good:

```text
Student
Save failed
Waiting for approval
You do not have permission
Payment could not be posted
```

Guide the next action:

```text
Next: Verify Documents
Next: Collect Payment
Next: Submit Attendance
Next: Approve Payroll
Next: Publish Notice
```

Important actions must show confirmation dialogs:

- Submit attendance.
- Collect payment.
- Reverse payment.
- Close cashier day.
- Lock marks.
- Publish result.
- Approve payroll.
- Post journal.
- Transfer student.
- Mark student inactive.
- Delete/soft-delete posts.
- Retry failed jobs.
- Open support override.

Confirmation dialogs must include what will happen, who/what is affected, whether it can be changed later, and a reason field for destructive/financial/audit-critical actions.

---

## 8. Shared Component System

Reuse shared components before redesigning screens.

Core web components:

```text
DashboardShell
Sidebar
Topbar
PageHeader
SectionCard
StatCard
StatusBadge
DataTable
FilterBar
SearchInput
ActionMenu
ConfirmDialog
Toast
EmptyState
LoadingState
ErrorState
PermissionState
AuditInfo
StudentAvatar
MoneyDisplay
DateDisplay
ProgressStepper
WorkflowTimeline
NotificationBadge
Tabs
```

Mobile/PWA components:

```text
MobileShell
MobileHeader
MobileBottomNav
MobileStatCard
MobileActionGrid
MobileNoticeCard
MobileHomeworkCard
MobileFeeCard
MobileAttendanceCalendar
MobileTimelineItem
ChildSwitcher
TripStatusCard
```

Component rules:

- Components must be reusable across modules.
- Avoid one-off styling inside pages.
- Keep variants explicit: `success`, `warning`, `danger`, `info`, `neutral`.
- Use semantic states instead of raw colors.
- All loading, empty, error, and permission-denied states must be reusable.

---

## 9. Module Screen Direction

### Dashboard

Main job: help the school admin understand what needs attention today.

Recommended sections:

```text
Welcome header
Today KPI cards
Today tasks
Attendance snapshot
Fee collection snapshot
Recent activity
Notices
Quick actions
```

Dashboard should be summary-only, not a full reports page.

### Students and Admissions

- Student directory should support quick search, class/section/status filters, clear action menus, and safe lifecycle actions.
- Student profile should group Overview, Attendance, Fees, Documents, Activity, Academics, Guardians, and History.
- Admissions should use a clear pipeline/stepper with document checklist and one main next action.

### Attendance

- Class → Section → Date selection.
- One-click `Auto Fill Present` and exception marking.
- Sticky bottom actions for `Save Draft` and `Submit`.
- Offline local draft recovery and conflict handling.

### Fees, Receipts, Accounting

- Split cashier collection from accountant/ledger controls.
- Payment, reversal, cashier close, and journal posting must be confirmation-driven and audited.
- Reports must display backend-calculated totals, not frontend-derived official totals.

### Academics

- Exams should follow a workflow: Enter → Validate → Lock → Publish → Generate Reports.
- Marks/CAS entry should support keyboard-friendly grids.
- Report-card correction/regeneration must require context and audit reason.

### Activity, Notices, Communication

- Activity Feed is classroom/social updates.
- Notices are official announcements.
- Photo-consent and media privacy must be visible and enforced.
- Delivery failures and unread-recipient follow-up should be visible to admins.

### Homework and Timetable

- Homework should group work by status: Due Today, Upcoming, Overdue, Checked.
- Timetable should show visual period/room/teacher conflicts.
- Teacher absence/substitution flows should be clear and action-oriented.

### HR and Payroll

- HR needs staff lifecycle visibility and sensitive-field masking.
- Payroll should use status stepper: Draft → Approved → Posted → Paid.
- Payroll reversals and payslip access must be permissioned and audited.

### Library, Transport, Canteen

- Library should favor scanner-first issue/return flows.
- Transport should show route/vehicle/trip status and location freshness before raw coordinates.
- Canteen should show wallet balance, allergy warnings, spending warnings, QR scan context, and POS/serving readiness clearly.

### Settings

- School settings should be grouped by operational domains.
- Developer/platform settings must be hidden from regular school admins.

---

## 10. Current UI Progress Snapshot

Current status:

```text
Admin web global polish is implemented for the current modular-monolith scope.
Dashboard shell polish, accounting audit context, transport location freshness, scanner-first Library/Canteen QR flows, report-card correction review, and app-controlled toasts/confirmation dialogs are present.
Next UI work is staging/browser QA for authenticated dashboard routes, delivery failures, retry/resend, QR/POS scan speed, provider/queue mutation states, and permission/error states.
```

Implemented highlights:

- Dashboard shell includes skip link, sharper card radius, readable section/stat typography, and clearer fee-alert routing.
- Accounting audit workspace surfaces summary cards, richer log detail, and loading/empty states.
- Transport latest-location workflow shows Fresh, Delayed, Stale, and No ping context.
- Library issue and Canteen serving/POS workflows use scanner-first copy/student QR context and warnings.
- Academics, Homework, Admissions, Staff, Students, and Platform operations use app-controlled feedback instead of browser-native `alert()`/`confirm()`.
- Web contract rejects future `alert()`/`confirm()` usage in `apps/web/app` and `apps/web/components`.
- Flutter parent, teacher, notification, staff, driver, and canteen surfaces now use purpose-limited APIs where available.

Verification snapshot:

```text
- Web contract tests passed for app-controlled feedback coverage.
- Web typecheck has passed in targeted polish runs.
- Browser/staging smoke still needs execution in an environment that can bind local ports and has Postgres, Redis, API, and web running.
```

---

## 11. Accessibility and Smoke Coverage

Required:

- Keyboard navigation and visible focus rings.
- `aria-label` for icon-only buttons.
- Skeleton/loading frames instead of confusing blank areas.
- Empty, error, and permission-denied states for all important routes.
- Smoke tests should verify core route loading and fatal-error absence without becoming brittle.
