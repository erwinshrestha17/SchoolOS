# SchoolOS Web Agent Instructions

Scoped rules for `apps/web`. Root `AGENTS.md` applies first.

This file is for Codex and repo-aware coding agents working on the SchoolOS Next.js web frontend.

---

## 1. Required Reading Before Web Work

Before changing web UI, routes, API clients, contracts, protected-file behavior, permissions, platform flows, or feature behavior, read the relevant files first:

```text
apps/web/AGENTS.md
apps/web/docs/DESIGN_SYSTEM.md
docs/README.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
docs/product/SCHOOLOS_BRD.md
docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/requirements/SCHOOLOS_SRS.md
docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md
```

Also read the existing routes, components, API clients, OpenAPI/backend routes, shared contracts, and tests for the touched module.

Do not guess contracts. If an endpoint, DTO, permission rule, job state, protected-file flow, or idempotency behavior is not confirmed, mark it as `needs backend verification` or `needs OpenAPI confirmation`.

---

## 2. Active Module Numbering

Use this numbering in web routes, labels, comments, tests, smoke names, and docs:

| Module | Name |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
| M4 | Academics, Exams, CAS, Report Cards |
| M5 | Activity Feed and Milestones |
| M6 | Homework and Timetable |
| M7 | HR and Payroll |
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M11 | Accounting and Finance |
| M12 | Notifications, Notices, Communication, Chat |
| M13 | Learning Layer |
| M14 | Intelligence / AI |

`M8A`, `M8B`, and `M8C` are obsolete. Library, Transport, and Canteen are standalone modules.

Inventory & Asset Management is not active web scope.

---

## 3. Web Product Rule

SchoolOS web is the daily command center for Nepal schools.

It should feel like a school operating desk, not a generic ERP, decorative dashboard template, shortcut wall, fake demo UI, or technical admin console for non-technical school users.

Core rule:

```text
One screen = one main job.
```

Every screen must quickly answer:

```text
1. Where am I?
2. What needs my attention?
3. What can I safely do here?
```

---

## 4. Non-Negotiables

- Next.js App Router stays in `apps/web`; no Angular migration.
- Use real backend APIs only.
- Backend tenant/RBAC/entitlement checks are truth; frontend hiding is UX only.
- Route planes stay separate: `/dashboard/*`, `/dashboard/settings/*`, `/platform/*`.
- School fee collection is not SaaS billing.
- M11 Accounting is a school accounting module, not platform billing.
- Growing lists use server-side pagination/filtering.
- Official finance, attendance, payroll, accounting, library, transport, canteen, notification, and learning totals come from backend responses.
- Private files use protected helpers, not raw private URLs.
- High-risk actions need confirmation, pending/success/error state, and reason where required.
- Do not expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session routes must use purpose-limited data, not admin-shaped payloads.
- No microservices or AI runtime/M14 UI unless explicitly approved.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 5. Design Rules

Follow `apps/web/docs/DESIGN_SYSTEM.md`.

- Calm light app background.
- White cards, tables, panels, and drawers.
- Clear typographic hierarchy.
- One primary action per page header.
- Secondary actions go under `More Actions`.
- Destructive actions are separated and confirmation-gated.
- Use shared UI primitives from `/components/ui` where available.
- Do not duplicate design primitives if a shared primitive exists.
- Module accents identify location; semantic status colors still control success/warning/error/info.
- Long tables must remain usable on laptops.
- Use school-friendly copy instead of raw backend/provider errors.

---

## 6. Web Surface Boundaries

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

---

## 7. API Client Expectations

Recommended API files include:

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

- Reuse shared contract types where they exist in `packages/core`.
- Keep OpenAPI and shared contracts in sync.
- Parse backend error envelopes consistently.
- File/blob downloads use authenticated helpers.
- Large exports use queued job/status UI where backend uses background jobs.
- Unknown route shapes are marked as `needs OpenAPI confirmation`.

---

## 8. Required Screen States

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

---

## 9. Standard Page Composition

### Standard module workspace

```text
ModuleHeader
KpiGrid / SummaryStrip
Tabs
FilterBar
MainContent
DetailDrawer / Modal / Wizard
Audit / Export / Protected File Actions
```

### Standard list workspace

Used for students, invoices, staff, books, vehicles, notices, journals, and users.

Rules:

- Header.
- KPI strip where useful (see KPI design rule below).
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

### KPI design rule

Use KPIs only to help a user prioritize, detect risk, or choose the next workflow. Not to decorate a screen into looking like a dashboard.

**Only the module landing/overview page is KPI-driven.** Every detailed work page is task-first: filters, table/grid, workflow state, validation, audit, one main action. Max 4-6 KPI cards on a desktop overview.

A KPI must be all four:

- Backend-owned, tenant- and permission-filtered.
- Time/context-bound: today, selected academic year, term, fiscal period, or active trip.
- Actionable: opens a real filtered queue or workspace on click.
- Honest: unavailable/loading/locked/partial data never renders as `0`.

Litmus test: *what is wrong or pending, and where do I go to fix it?* If a card cannot answer that, remove it. No summary API -> explicit unavailable state or omit, never a placeholder `0`. No drill-through -> it is not a KPI; use a status badge, queue row, or workflow banner instead.

M4 Academics and Accounting are especially strict: never compute counts, readiness percentages, grades, balances, or money totals from browser-loaded lists. Bounded backend summaries only.

| Module | KPIs go on | Recommended cards | Never on |
|---|---|---|---|
| M0 Platform Core | Platform operator overview only | Active/suspended tenants, onboarding blockers, unhealthy providers, failed queue jobs, storage/export issues | Tenant onboarding wizard, provider setup, queue-job detail, support override, audit detail |
| M1 Admissions & Student Profiles | Admissions overview, student ops overview | Pending admissions, missing documents, duplicate candidates, approval queue, iEMIS readiness | Admission wizard, student profile, guardian editor, document upload, duplicate-resolution detail, QR detail |
| M2 Smart Attendance | Attendance overview, principal triage | Classes not submitted, completion today, absent/late students, corrections pending, anomalies | Teacher attendance register, correction form, monthly register, individual student history |
| M3 Fees & Receipts | Fees overview, cashier dashboard, principal finance snapshot | Collection today, outstanding dues, pending reversals/refunds, cashier-close status, reconciliation exceptions | Payment collection screen, receipt detail, student ledger, reversal form, cashier-close form |
| M4 Academics/Exams/Report Cards | Academic overview only | Upcoming exam terms, marks sheets pending, locked-sheet corrections, result readiness, report-card job status | Marks-entry grid, CAS entry, grade setup, result detail, report-card detail, promotion decision page |
| M5 Activity Feed & Milestones | Activity/admin moderation overview | Draft posts, moderation queue, failed media processing, consent blocks, parent delivery issues | Activity composer, gallery, post detail, milestone editor, media preview |
| M6 Homework & Timetable | Homework overview, timetable overview | Homework due soon, submissions awaiting review, unpublished homework, timetable conflicts, substitutions today | Homework composer, submission review, timetable builder, conflict-resolution screen, version detail |
| M7 HR & Payroll | HR overview, payroll overview | Staff present, staff on leave, pending leave approvals, contracts expiring, payroll-run state | Staff profile, salary structure editor, payroll-run detail, payslip detail, leave decision form |
| M8 Library | Library overview | Loans due/overdue, reservations waiting, issues/returns today, lost/damaged items, fine-review queue | Book detail, copy management, issue/return counter, borrower history, fine detail |
| M9 Transport | Transport dashboard | Trips today, active/delayed/stale trips, students without assignment, expiring vehicle documents, boarding exceptions | Route editor, vehicle form, trip operation screen, driver assignment, parent transport page |
| M10 Canteen | Canteen manager dashboard | POS sales today, meals served, low-stock items, low-wallet alerts, allergy alerts, pending vendor bills | POS sale, QR serving/scanning, wallet top-up, stock adjustment, vendor bill form |
| M11 Accounting & Finance | Accounting overview, principal read-only finance snapshot | Period status, vouchers awaiting approval, reconciliation exceptions, receivables/payables, report snapshot status | Voucher editor, journal-entry detail, reconciliation workspace, account setup, fiscal-close workflow |
| M12 Notifications/Notices/Chat | Communication operations dashboard | Notices scheduled, failed deliveries, unread high-priority notices, open escalations, provider/queue health | Notice composer, recipient preview, delivery-log detail, chat thread, moderation case detail |
| M13 Learning Layer | Teacher/admin learning overview | Active sessions, activities awaiting launch/review, session issues, submissions needing review | Activity editor, live classroom session, student activity screen, parent learning summary |
| M14 AI / Intelligence | None until explicitly approved | None | Do not create KPI or analytics UI yet |

Implementation priority (core operational workspaces first, then academics/finance, then HR/extended ops): (1) Principal Home cross-module attention, (2) M1 Admissions, (3) M2 Attendance, (4) M3 Fees, (5) M4 Academics, (6) M6 Homework & Timetable, (7) M12 Communication. Then M7, M8, M9, M10, M11, M13 as those workspaces are polished.

Replace KPIs with the record/workflow state itself on task pages, e.g.: forms (stepper, draft/saved state, validation errors), registers/grids (`Marked 28 of 30`, `Saving`, `Submitted`, `Locked`), financial workflows (payment status, balance due, idempotency/pending confirmation, audit status), queues (server total, active filters, pending/failed count), detail pages (lifecycle status, audit timeline, protected-file state). Mobile: one urgent task card, not a KPI wall.

---

## 10. Module Rules

### M1 Admissions and Student Profiles

- Manage inquiry/admission, profile, guardians, documents, QR/ID card, lifecycle history, duplicate review, and iEMIS readiness.
- Teacher limited scope must not see unrelated students.
- Student files use protected helpers.

### M2 Smart Attendance

- Teacher can mark assigned class only.
- Correction requires reason.
- Locked dates cannot be edited silently.
- Monthly register export uses protected helper.

### M3 Fees and Receipts

- Backend owns official totals.
- Use Decimal/numeric values from backend.
- Payment submit must be idempotent.
- Receipt appears only after confirmed backend success.
- Reversal/refund requires reason, permission, and audit.

### M4 Academics, Exams, CAS, and Report Cards

- Subject teacher cannot edit unassigned subject marks.
- Locked report card cannot be regenerated unsafely.
- Report-card PDF opens through protected helper.
- Publish action requires confirmation.

### M5 Activity Feed and Milestones

- Active-student tagging only.
- Consent warnings before publish.
- Parent sees linked-child and consent-safe media only.
- Removed guardians lose access.
- Media preview/download uses protected helper.

### M6 Homework and Timetable

- Conflict panel visible while editing.
- Publish/lock/archive require permission and audit.
- Attachments use File Registry.
- Parent/student see assigned published work only.

### M7 HR and Payroll

- Keep admin HR/payroll routes separate from staff self-service routes.
- Salary, bank, PAN, payslip, and staff document fields are permission-gated and masked by default.
- Payroll totals are backend-owned.
- Posted payroll is immutable in UI; changes happen through reversal/correction workflows only.

### M8 Library

- Optimize issue/return for scanner-first counter workflow.
- Show borrower eligibility/status before confirming.
- Parent library view is child-scoped.
- Fine calculations and copy totals come from backend.

### M9 Transport

- Use latest GPS/status tables first.
- Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed.
- Parent status is child-route scoped and timestamped/stale-labelled.
- Driver/conductor screens are assigned-trip scoped.

### M10 Canteen

- Allergy/medical warning visible before serving.
- Wallet debit is backend atomic truth.
- Duplicate serve state handled.
- Receipt/proof uses protected helper.

### M11 Accounting and Finance

- No client-owned accounting truth.
- Posted records use reversal/correction flow.
- Period close/reopen is high risk and requires reason.
- Large exports use File Registry and job status.

### M12 Notifications, Notices, Communication, and Chat

- Source modules emit events; M12 owns delivery lifecycle.
- Quiet hours are visible and enforced by backend.
- Parent-teacher scope only where allowed.
- Attachments use File Registry.
- Escalation/report actions are audited.
- Provider-disabled, mock, failed, partial, and queued delivery states are explicit.

### M13 Learning Layer

- Teacher assigned-scope.
- Resources protected.
- Student runtime is active-session only.
- Parent sees own child only.
- Student sees own attempt/result only.
- No public leaderboard.
- No AI tutor/runtime unless approved.

### M14 Intelligence / AI

- Deferred roadmap only.
- No AI runtime, LLM calls, prediction UI, or automated decisions unless explicitly approved.

---

## 11. Implementation Order

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
   - M12 Notifications/Communication.

4. **W4 Operational modules**
   - M6 Homework/Timetable.
   - M7 HR/Payroll.
   - M8 Library.
   - M9 Transport.
   - M10 Canteen.

5. **W5 Accounting, Learning, Settings, Platform**
   - M11 Accounting.
   - M13 Learning.
   - School Settings.
   - Platform Control Plane.

6. **W6 Polish and verification**
   - Accessibility.
   - Browser E2E.
   - Contract verification.
   - Permission/module locked states.
   - Staging smoke.

---

## 12. Verification Commands

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
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
```

Report any command that cannot run and why.
