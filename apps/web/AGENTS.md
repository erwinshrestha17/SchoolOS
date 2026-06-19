# SchoolOS Web Agent Instructions

Scoped rules for `apps/web`. Root `AGENTS.md` applies first.

This file is written for Codex and any repo-aware coding agent working on the SchoolOS Next.js web frontend.

---

## 1. Required Reading Before Web Work

Before changing web UI, routes, API clients, contracts, protected-file behavior, permissions, platform flows, or feature behavior, read the relevant files first.

Required baseline:

```text
apps/web/AGENTS.md
apps/web/docs/DESIGN_SYSTEM.md
```

Also read where relevant:

```text
SchoolOS web frontend design plan docs
docs/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md when touching M7 HR & Payroll
Project status/plan docs
Architecture/security docs
Platform operations docs
e2e/README.md
Existing routes/components/API clients/contracts/tests for the touched module
OpenAPI/backend routes for the touched feature
packages/core shared contract types where used
```

Do not guess contracts. If an endpoint, DTO, permission rule, job state, protected-file flow, or idempotency behavior is not confirmed, mark it explicitly as `needs backend verification` or `needs OpenAPI confirmation`.

---

## 2. Web Product Rule

SchoolOS web is the daily command center for Nepal schools.

It should feel like:

```text
A school operating desk.
```

It must not feel like:

```text
A generic ERP.
A decorative dashboard template.
A shortcut wall.
A fake demo UI.
A technical admin console for non-technical school users.
```

Core rule:

```text
One screen = one main job.
```

Every web screen must answer within 10 seconds:

```text
1. Where am I?
2. What needs my attention?
3. What can I safely do here?
```

---

## 3. Non-Negotiables

Never break these rules:

- Next.js App Router stays in `apps/web`; no Angular migration.
- Web is the daily school operating desk: one screen = one main job.
- Use real backend APIs only.
- No fake production data, placeholder metrics, or browser-only truth.
- Backend tenant/RBAC/entitlement checks are truth; frontend hiding is UX only.
- Route planes stay separate: `/dashboard/*`, `/dashboard/settings/*`, `/platform/*`.
- School fee collection is not SaaS billing.
- M9 Accounting is a school accounting module, not a platform billing microservice.
- Growing lists use server-side pagination/filtering.
- Official finance/attendance/payroll/accounting totals come from backend.
- Private files use protected helpers, not raw private URLs.
- High-risk actions need confirmation, pending/success/error state, and reason where required.
- Do not expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited data, not admin-shaped payloads.
- No microservices or AI runtime/M11 UI unless explicitly approved.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 4. Required Web Design Rules

Before UI work, read:

```text
apps/web/docs/DESIGN_SYSTEM.md
```

Follow these UI rules:

- Calm light app background.
- White cards, tables, panels, and drawers.
- Soft blue-grey page background.
- Deep blue/indigo primary identity unless existing theme tokens define otherwise.
- Rounded cards and panels, generally 16-24px radius.
- Subtle borders and shadows only where hierarchy requires it.
- Clear typographic hierarchy.
- Charts only when they help decisions.
- No decorative gradients as the main UI language.
- No crowded dashboard cards.
- One primary action per page header.
- Secondary actions go under `More Actions`.
- Destructive actions are never the main decorative CTA.
- Use school-friendly copy instead of raw technical/backend/provider errors.
- Use shared UI primitives from `/components/ui` where available.
- Do not duplicate design primitives if a shared primitive exists.
- Module accents identify location; semantic status colors still control success/warning/error/info.
- Long tables must remain usable on laptops.
- Dense operational pages still need clear context, filters, server pagination, and safe states.

---

## 5. Web Surface Boundaries

SchoolOS web has three major planes.

| Plane | Route family | Purpose |
|---|---|---|
| School Operations | `/dashboard/*` | Daily school workflows. |
| Tenant Configuration | `/dashboard/settings/*` | One school's configuration. |
| Platform Control Plane | `/platform/*` | SaaS tenant, provider, queue, support, and platform operations. |

Rules:

- School Operations must never expose platform-only controls.
- School Settings must not become SaaS billing/platform configuration.
- Platform must not expose tenant-private data unless explicit audited support override is active.
- Platform operator workflows are not school user workflows.
- Support override must be visible, reasoned, expiring, and audited where supported.

---

## 6. Next.js and API Rules

### 6.1 Next.js rules

- Server Components by default.
- Client Components only for interactivity and marked with `use client`.
- URL `searchParams` for filters and pagination.
- React Hook Form + Zod for critical forms where existing patterns support it.
- Error boundaries on major sections.
- Route protection via middleware and backend session checks, not only client guards.
- No raw tokens in browser storage.
- Minimal global state.
- No duplicate UI primitives.
- Shared primitives in `/components/ui`.
- Feature components under feature/module folders.

### 6.2 API client expectations

Use existing client helpers. Recommended API file locations include:

```text
apps/web/lib/api/client.ts
apps/web/lib/api/auth.ts
apps/web/lib/api/platform.ts
apps/web/lib/api/students.ts
apps/web/lib/api/admissions.ts
apps/web/lib/api/attendance.ts
apps/web/lib/api/finance.ts
apps/web/lib/api/academics.ts
apps/web/lib/api/activity.ts
apps/web/lib/api/homework.ts
apps/web/lib/api/hr.ts
apps/web/lib/api/payroll.ts
apps/web/lib/api/library.ts
apps/web/lib/api/transport.ts
apps/web/lib/api/canteen.ts
apps/web/lib/api/accounting.ts
apps/web/lib/api/communications.ts
apps/web/lib/api/messaging.ts
apps/web/lib/api/learning.ts
apps/web/lib/api/reports.ts
apps/web/lib/api/settings.ts
```

Rules:

- Do not duplicate contract types if they exist in `packages/core`.
- Keep OpenAPI and shared contracts in sync.
- Parse backend error envelopes consistently.
- File/blob downloads use authenticated helpers.
- Large exports use queued job/status UI when backend uses background jobs.
- Unknown route shapes are marked as `needs OpenAPI confirmation`.

### 6.3 Query and mutation states

For every query:

```text
loading -> success(empty/non-empty) -> error -> retry
```

For every mutation:

```text
idle -> confirming if high risk -> pending -> success/error -> refetch/invalidate
```

Financial/idempotent mutations also need:

```text
idempotency key / duplicate-safe backend behavior / pending state / receipt status
```

---

## 7. Backend Gap Rule

If a screen needs data and no safe endpoint exists:

1. Do not fake it.
2. Do not compute official values in the browser.
3. Inspect existing API clients, backend controllers, OpenAPI/contracts, and permissions.
4. If it meets production criteria, add/request a module-owned, tenant-scoped, RBAC/entitlement-gated backend API and connect it.
5. If not, keep a friendly unavailable/locked/permission state.
6. Mark the gap as `needs backend verification` or `needs OpenAPI confirmation`.

Developer-facing `Needs backend API` text is internal only. Pilot-facing UI uses friendly unavailable/error/locked/permission copy.

---

## 8. Protected File Rules

Protected files include:

```text
Receipts
Cashier close PDFs
Report cards
Payscale/payroll slips
Student documents
Student photos
School logo where private
Activity media
Notice attachments
Homework attachments
Learning resources
Accounting reports
Exports and snapshots
Generated documents
```

Rules:

- Use File Registry-backed authenticated helpers.
- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared blob/download helpers.
- Do not use raw `window.open` for private file URLs.
- Do not persist raw signed URLs in client state beyond the immediate action.
- Do not expose object keys, provider bucket URLs, or permanent signed URLs.
- File unavailable, permission denied, expired, or missing states must be friendly and safe.

File UI flow:

```text
User action
-> permission check by backend
-> File Registry lookup
-> short-lived preview/download response or blob helper
-> audit where required
-> safe browser action
```

---

## 9. Required Screen States

Every screen must explicitly handle:

| State | Web behavior |
|---|---|
| Loading | Skeleton matching layout; preserve title and filters. |
| Empty | Explain why no data exists; show one safe CTA if allowed. |
| Error | Show parsed school-friendly backend error, retry, and preserved filters. |
| Permission denied | Explain user lacks permission; avoid revealing forbidden data. |
| Module locked | Show plan/module locked state; no fake fallback values. |
| Success | Toast or inline success; refetch/invalidate relevant data. |
| Validation | Inline field errors plus optional summary for long forms. |
| File unavailable | Explain file is missing, expired, or restricted. |
| Slow network | Preserve current data; show retry or last updated. |
| Queued job | Show queued/processing/succeeded/failed from backend. |
| Partial failure | Show exactly which items failed and which succeeded. |

Copy examples:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
Attendance is locked for this date.
This report is being prepared. You can download it when it is ready.
```

Never show raw technical copy such as:

```text
403 Forbidden
Mutation failed
Unhandled exception
PrismaClientKnownRequestError
Invalid payload
Object key missing
```

---

## 10. Page Composition Rules

### 10.1 Standard module workspace

```text
ModuleHeader
KpiGrid / SummaryStrip
Tabs
FilterBar
MainContent
DetailDrawer / Modal / Wizard
Audit / Export / Protected File Actions
```

### 10.2 Standard list workspace

Used for students, invoices, staff, books, vehicles, notices, journals, and users.

Rules:

- Header.
- KPI strip where useful.
- Tabs if needed.
- Filter bar.
- Table with server pagination.
- Selected row detail drawer.
- Bulk actions only where safe.
- Export/report footer where allowed.
- Visible total count from backend/list metadata.
- Active filter chips.
- One primary row action.
- Secondary row actions in `More`.
- Destructive row actions separated with confirmation.
- Sensitive columns hidden unless permission allows.

### 10.3 Standard workflow workspace

Used for admission, payment, payroll run, timetable builder, report-card generation, reconciliation, and import review.

Rules:

- Header.
- Step/status banner.
- Left primary form or builder.
- Right live summary / validation / audit / preview.
- Sticky action footer: Back / Save Draft / Continue / Submit.
- Save draft only if backend supports draft persistence.
- Final submit shows impact preview.
- Financial or lifecycle workflows require reason where policy requires it.

### 10.4 Right drawer pattern

Use drawers for quick inspect/edit/review without losing list context.

Drawer content order:

```text
Title / record identity
Status and important metadata
Main details
Actions
Audit timeline / history
Related protected files
```

Use full routes instead of drawers only for large or primary workflows such as student profile, staff profile, report-card batch review, payroll run, accounting reconciliation, timetable builder, large imports, learning activity builder, and controlled learning runtime routes.

---

## 11. Main Dashboard Rules

The dashboard is the school command center. It is not a place to show every module in depth.

It answers:

```text
What is happening today?
What needs attention?
Which module needs action?
What can this user do quickly?
```

Dashboard layout:

```text
Welcome / School Status Header
School-wide KPI Strip
Today's Operations
Pending Approvals and Alerts
Module Summary Grid
Recent Activity Timeline
Role-Based Quick Actions
Optional decision charts
```

Rules:

- Use dedicated summary APIs.
- Use safe module summary metadata.
- Use permission-filtered response shapes.
- Show unavailable summary state when the summary endpoint is missing.
- Do not deep-fetch every module.
- Do not show private payroll details.
- Do not show private chat contents.
- Do not show raw student-sensitive data.
- Do not show locked module fake values.
- Do not show finance totals if the user lacks permission.
- KPI click-through should preserve filters.

---

## 12. Form Rules

Critical forms include admissions, attendance corrections, fee payments, reversals, refunds, payroll, accounting journals, report-card publishing, settings, platform actions, and learning activity builder.

Rules:

- Use clear sections.
- Use school labels.
- Required fields are visible before submit.
- Inline validation beside fields.
- Summary validation for long forms.
- Save buttons show pending state.
- Submit buttons disabled only while request is pending or form is invalid.
- Do not lose user input after recoverable errors.
- Destructive/high-risk forms require confirmation.
- Reason field required where audit policy requires it.
- Currency fields use backend Decimal/numeric truth.
- Dates show clear local school date context.

---

## 13. Search and Filter Rules

Global search should support where backend permits:

```text
Student name
Admission number
Guardian phone
Invoice number
Receipt number
Staff name
Book barcode
Vehicle number
Notice title
```

Global search rules:

- Tenant-scoped.
- Role-scoped.
- Permission-filtered.
- Shows type labels.
- Does not expose forbidden record names.
- Opens safe detail route/drawer.

Filter rules:

- Use URL `searchParams` for lists where practical.
- Include reset/clear filters.
- Show active filter chips.
- Server-side filtering for growing data.
- Preserve filters across detail drawer open/close.

---

## 14. Module Rules

### 14.1 M1 Admissions and Student Profiles

- Manage lifecycle from inquiry/admission to profile, guardians, documents, QR/ID card, lifecycle history, duplicate review, and iEMIS readiness.
- Teacher limited scope must not see unrelated students.
- Duplicate warnings visible before conversion.
- Conversion action requires permission.
- Rejection requires reason.
- Student files use protected helpers.

### 14.2 M2 Smart Attendance

- Teacher can mark assigned class only.
- Direct unassigned class route denies safely.
- Correction requires reason.
- Locked date cannot be edited silently.
- Monthly register export uses protected helper.
- Offline draft visibility must be honest if supported by backend.

### 14.3 M3 Fees and Receipts

- Backend owns official totals.
- Use Decimal/numeric values from backend.
- Do not use JS floating calculations as truth.
- Payment submit must be idempotent/backed by backend duplicate protection.
- Receipt appears only after confirmed backend success.
- Reversal/refund requires reason, permission, and audit.
- Cashier close shows expected vs actual with reason for difference.

### 14.4 M4 Academics, Exams, CAS, and Report Cards

- Subject teacher cannot edit unassigned subject marks.
- Locked report card cannot be regenerated unsafely.
- Report-card PDF opens through protected helper.
- Publish action requires confirmation.
- Parent published-only rule preserved.

### 14.5 M5 Activity Feed and Milestones

- Active-student tagging only.
- Consent warnings before publish.
- Parent sees linked-child and consent-safe media only.
- Removed guardians lose access.
- Media preview/download uses protected helper.
- Moderation actions audited.

### 14.6 M6 Homework and Timetable

- Conflict panel visible while editing.
- Teacher conflict, room conflict, and period conflict shown clearly.
- Publish/lock/archive require permission and audit.
- Attachments use File Registry.
- Parent/student see assigned published work only.

### 14.7 M7 HR and Payroll

Before touching M7 web UI, read:

```text
docs/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md
```

Core rules:

- Keep admin HR/payroll routes separate from staff self-service routes.
- Use one consistent M7 navigation model across overview, staff, contracts, attendance, leave, salary, payroll, payslips, reports, and settings.
- Staff directory uses server-side pagination/filtering and a permission-safe selected-staff rail.
- Staff profile is a full protected route, not only a drawer.
- Salary, bank, PAN, payslip, and staff document fields are permission-gated and masked by default.
- Staff self-service sees only purpose-limited own-profile, own-attendance, own-leave, own-payslip, and own-notice data.
- Payslip and staff-document previews/downloads use protected helpers only.
- Leave approval actions show balance, payroll impact, pending state, and audit history where backend supports it.
- Payroll totals, worked hours, overtime, leave balances, salary previews, statutory deductions, and journal previews are backend-owned.
- Payroll run has a visible state machine: `Draft -> Review -> Approved -> Posted -> Reversed`.
- Posted payroll is immutable in UI; changes happen through reversal/correction workflows only.
- Payroll posting/reversal/approval/recalculation/locking requires confirmation, reason where policy requires it, and audit support.
- `Post Payroll` is disabled when exceptions, period lock, posting lock, or accounting integration state is unsafe.
- Salary structures are versioned and effective-dated; do not silently mutate an active structure.
- Large HR/payroll exports use queued/protected job flow where backend supports it.

### 14.8 M8A Library

- Optimize issue/return for scanner-first counter workflow.
- Show borrower eligibility/status before confirming.
- Confirm issue/return and show receipt/status if supported.

### 14.9 M8B Transport

- Use latest GPS/status tables first.
- Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed.
- Transport data must not expose unrelated student academic or private details.

### 14.10 M8C Canteen

- Allergy/medical warning visible before serving.
- Staff acknowledgement required before submit where backend requires it.
- Wallet debit is backend atomic truth.
- Duplicate serve state handled.
- Receipt/proof uses protected helper.

### 14.11 M9 Accounting and Finance

- No client-owned accounting truth.
- Posted records use reversal/correction flow.
- Period close/reopen is high risk and requires reason.
- Large exports use File Registry and job status.
- Reconciliation suggestions must not auto-post without user confirmation and backend audit.

### 14.12 M10 Notices, Communication, and Chat

- Quiet hours visible and enforced by backend.
- Parent-teacher scope only where allowed.
- Personal data sharing warnings where policy requires.
- Attachments use File Registry.
- Escalation/report actions audited.
- Delivery retry requires safe provider state and reason where configured.

### 14.13 M12 Learning Layer

- Teacher assigned-scope.
- Resources protected.
- Student runtime is active-session only.
- Parent sees own child only.
- Student sees own attempt/result only.
- No public leaderboard.
- No AI tutor/runtime.
- Use supportive, non-comparative language.

---

## 15. Settings and Platform Rules

### 15.1 School Settings

School Settings controls one school's configuration, not daily operations.

Rules:

- All settings mutations audited.
- Sensitive settings require reason/confirmation.
- Module visibility does not override SaaS entitlement.
- Provider secrets masked.
- Logo/file settings use File Registry.
- Backup restore is high risk.
- Platform settings never appear here.

### 15.2 Platform Control Plane

Platform is for SchoolOS operators, not school users.

High-risk platform actions require:

1. Permission.
2. Reason.
3. Confirmation.
4. Impact preview.
5. Audit log.
6. Visible support override state where relevant.

Examples:

- Suspend tenant.
- Disable module.
- Retry/discard failed jobs.
- Restore backup.
- Enter support override.
- Force logout.
- Delete platform admin.
- Enable maintenance mode.

---

## 16. Reports and Exports

Reports and exports must be designed as real workflows, not raw file links.

Report lifecycle:

```text
Request report
-> Validate filters and permissions
-> Generate immediately or queue job
-> Show status
-> Download through protected helper
-> Show audit/export history where relevant
```

Report screen requirements:

- Clear filters.
- Clear date/fiscal period context.
- Show report status.
- Export button disabled while generating.
- Show queued job state for long reports.
- Show failed state with safe diagnostics.
- Use File Registry artifacts for retained exports.

---

## 17. Accessibility and Usability Rules

Minimum requirements:

- Keyboard-reachable dialogs, menus, selects, tabs, and sheets.
- Visible focus states.
- Labeled form inputs.
- Inline validation messages.
- Tables with clear headers.
- Status not communicated by color only.
- Icon-only buttons require `aria-label`.
- Destructive actions not placed next to safe actions without separation.
- Touch/click targets large enough for school office use.
- Long tables remain readable on laptops.
- Print/download actions labelled clearly.

---

## 18. Codex Workflow for Web Work

Use this sequence for web UI/design tasks:

```text
1. Read root AGENTS.md, apps/web/AGENTS.md, and apps/web/docs/DESIGN_SYSTEM.md.
2. Inspect existing routes, layout shell, components/ui, feature components, API clients, contracts, and tests for the touched module.
3. Confirm route plane: /dashboard, /dashboard/settings, or /platform.
4. Audit the current screen before editing.
5. Identify missing states: loading, empty, error, success, permission denied, module locked, file unavailable, queued job, partial failure.
6. Implement the smallest useful scoped change.
7. Reuse existing design system and shared UI primitives.
8. Preserve existing auth, RBAC, tenant scope, module entitlements, routing, API clients, and contracts unless explicitly asked otherwise.
9. Run relevant verification commands when code changes are made.
10. Report changed files, verification results, assumptions, unresolved backend/API gaps, and remaining risks.
```

For visual polish tasks, prefer small scoped passes:

```text
Audit -> Implement one page/workspace -> Review UI -> Polish -> Verify
```

Do not redesign the whole web app in one task unless explicitly requested.

---

## 19. Implementation Order

Use this order unless the user explicitly changes priority:

1. **W1 Shared UI foundation and shell standardization**
   - Shared states.
   - Topbar/sidebar shell.
   - Role/module navigation.
   - Protected file components.
   - Table/filter primitives.
   - Dialog/reason patterns.

2. **W2 Main dashboard command center**
   - Real summaries or unavailable states.
   - Role quick actions.
   - Pending approvals.
   - Recent activity.

3. **W3 High-use daily modules**
   - M1 Students/Admissions.
   - M2 Attendance.
   - M3 Fees.
   - M4 Academics/Report Cards.
   - M10 Notices/Communication.

4. **W4 Operational modules**
   - M6 Homework/Timetable.
   - M7 HR/Payroll.
   - M8A Library.
   - M8B Transport.
   - M8C Canteen.

5. **W5 Accounting, Learning, Settings, Platform**
   - M9 Accounting.
   - M12 Learning.
   - School Settings.
   - Platform Control Plane.

6. **W6 Polish and verification**
   - Accessibility.
   - Browser E2E.
   - Contract verification.
   - Permission/module locked states.
   - Staging smoke.

---

## 20. Web Persona Smoke Expectations

Every persona smoke should prove:

1. User can log in.
2. User lands on the correct dashboard/surface.
3. Navigation matches role permissions.
4. Hidden modules are not visible.
5. Direct forbidden routes show safe state.
6. Allowed tenant records are visible.
7. Unallowed records are not visible.
8. Allowed actions work with loading/success/error handling.
9. Forbidden actions are hidden and backend-blocked if attempted.
10. Protected files require authenticated access.
11. Logout/session expiry returns safely to login.

Cross-persona checks:

```text
Parent cannot access another parent's child.
Student lab user cannot access another student's attempt/progress.
Teacher cannot access another class unless assigned or explicitly permitted.
Subject teacher cannot enter marks for unassigned subject.
Cashier cannot reverse/refund without permission.
Principal cannot view salary details without payroll permission.
Platform operator cannot view tenant-private data without support override.
Module-locked route shows ModuleLockedState and backend blocks action.
```

---

## 21. Screen Completion Checklist

Before marking a web screen/module complete:

```text
[ ] One clear title, purpose line, main job, and primary action.
[ ] Uses real backend APIs only.
[ ] No fake/mock/placeholder production data.
[ ] Endpoint shape confirmed from code/OpenAPI/contracts.
[ ] Tenant-scoped API calls and backend checks confirmed.
[ ] RBAC and module entitlement states handled.
[ ] Direct forbidden route shows safe state.
[ ] Loading, empty, error, success, permission, and locked states exist.
[ ] Lists are paginated and filtered server-side where needed.
[ ] Protected files use authenticated helpers.
[ ] Mutations show pending/success/error state.
[ ] High-risk mutations require confirmation and reason where required.
[ ] Financial totals come from backend.
[ ] Audit-sensitive action has UI reason and backend audit support.
[ ] No raw Prisma/storage/provider errors exposed.
[ ] No raw object keys or signed URLs displayed.
[ ] Accessibility basics checked.
[ ] Browser smoke route added or updated where useful.
```

---

## 22. Verification Commands

For docs-only changes, no runtime commands are required.

For frontend implementation changes, run relevant gates and do not claim passing unless actually run:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot
```

Web-specific checks:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
```

If a command cannot run, report exactly why.

---

## 23. Git Safety Rules

- Do not delete branches unless explicitly requested.
- Do not merge PRs unless explicitly requested.
- Do not remove unrelated files.
- Keep documentation-only changes separate from code changes where practical.
- Keep web work scoped to `apps/web` unless root-level docs/config changes are explicitly necessary.
- Report commit SHA/PR link after repository changes.

---

## 24. Final Rule

Every web screen either earns or erodes school trust.

School staff should feel:

```text
I know where I am.
I know what needs attention.
I know what action is safe.
I understand why something is blocked.
I can trust the numbers and files shown here.
```

That is the standard for the SchoolOS Next.js web frontend.
