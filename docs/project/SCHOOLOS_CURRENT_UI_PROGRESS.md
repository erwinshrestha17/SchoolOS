# SchoolOS Current UI Progress

This file records the latest web-admin UI/UX implementation progress so large roadmap files do not need broad rewrites for every sprint update.

## Current UI Sprint

```text
Current UI sprint: Phase Gate 0 UI verification and Operations vertical hardening.
```

Current repo reality:

```text
Library, Transport, and Canteen admin route foundations are present in apps/web.
Next UI work is not broad route creation; it is smoke verification, QR/manual QA, report/export polish, scan/POS speed polish, and role-specific depth.
```

## Current Sprint (Completed)

### UI-6E — Deeper Finance/Accounting Reports Visual Polish, Academics Marks/CAS Keyboard UX

Status: **Completed**.

Focus: Enhancing daily operator usability for high-frequency workflows (Finance/Accounting and Academics).

Completed:

- **Accounting Reports Polish:**
  - Implemented `ReportFilters` with fiscal year status indicators and better date range layout.
  - Revamped `ReportTable` with sticky headers, better numeric alignment, and prominent footer rows.
  - Updated `AccountingReportsView` with a cleaner report selection UI, `PageHeader` integration, and enhanced loading/error states.
  - Standardized money display and status colors across financial statements.
- **Academics Keyboard UX:**
  - Integrated grid-style keyboard navigation (Arrow keys, Enter, Shift+Enter) into the marks entry workspace.
  - Implemented similar keyboard navigation in the CAS batch roster.
  - Updated `DataTable` to support row-indexed cell rendering for focus management.
  - Added visual focus rings and improved input styling for rapid data entry.
- **Design System & Global CSS:**
  - Added `premium-input` and typography utility classes (`font-black`, `tracking-tight`) to `globals.css`.
  - Polished `SectionCard` with sharper typography and better spacing.
- **Verification & Testing:**
  - Created `apps/web/e2e/ux-polish-keyboard.spec.ts` to verify keyboard navigation workflows.
  - Updated `apps/web/e2e/accounting-smoke.spec.ts` for the new filter layout.

### UI-6D — Real-Credential Pilot QA and Verification Hardening

Status: **Completed**.

Focus: Stabilizing the main branch for controlled pilot QA, environment hardening, and real-credential smoke readiness.

Completed:

- **Environment & Credentials:**
  - Documented and configured required environment variables for authenticated smoke testing.
  - Set up `SCHOOLOS_E2E_*` and `SCHOOLOS_E2E_PLATFORM_*` variables.
- **Seed Data Hardening:**
  - Updated `apps/api/prisma/seed.ts` to be fully idempotent and provide sufficient data for all dashboard modules.
  - Added real sample data for Students, Finance (Invoices), Library, Transport, and Canteen.
  - Added platform operator user seed.
- **Browser Smoke (Phase 2F):**
  - Enhanced `apps/web/e2e/phase2f-browser-smoke.spec.ts` with real-credential support and improved selector robustness.
  - Added specific checks for seeded student "STU001" and improved fatal error detection (Next.js specific error strings).
  - Verified clean test skip behavior in unconfigured environments.
- **Verification Gate:**
  - Executed full verification gate (generate, validate, lint, typecheck, build).
  - Identified and documented sandbox/local-port connectivity restrictions for smoke testing.

## Next Recommended Sprint

```text
Phase Gate 0 UI Verification:
credential-gated route smoke, permission-denied states, stale link cleanup, and QR manual QA.
```

## Following Sprint

```text
UI-7B: Advanced Operations & Audit Logging.
```

## Completed / Foundation-Complete UI Work

### UI-6C — Targeted Frontend Module Polish and Browser Smoke Coverage

Status: **Completed**.

Completed:

- **Students/Admissions:**
  - Improved student directory search/filter clarity.
  - Added guardian search clarity.
  - Improved status badges and compact student row summary.
  - Improved empty state and row actions.
  - Student profile command header / quick links (attendance, documents, QR, fees, ID card, edit).
- **Attendance/Fees:**
  - Polished attendance daily workflow and accessible selectors.
  - Clarified Clear Exceptions behavior.
  - Added count summary before submit.
  - Improved draft/sync wording.
  - Fees routes covered in smoke tests (no client-side finance truth moved).
- **Academics:**
  - Reworked academics dashboard workflow cards.
  - Readiness derived from backend-loaded data instead of placeholders.
  - Workflow: Setup → Marks/CAS → Lock → Report Cards → Promotion → Publish.
- **Accounting:**
  - Added targeted smoke coverage for accounting dashboard/report routes.
- **Library/Canteen:**
  - Added readable confirmations for lost/damaged copy actions.
  - Added readable confirmations for meal enrollment cancellation.
  - Added readable confirmations for POS completion/cancellation.
- **Transport:**
  - Improved dashboard metrics.
  - Replaced trip complete/cancel window.confirm with consistent confirmation dialogs.
  - Clarified latest-location/stale tracking messaging.
- **Settings/Platform:**
  - Fixed communication settings timezone section saves.
  - Clarified queued-message behavior for Nepal-friendly hours.
  - Added platform permission behavior coverage in browser smoke tests.
- **Browser Smoke (Phase 2F):**
  - Updated `apps/web/e2e/phase2f-browser-smoke.spec.ts` with credential-gated workflow coverage for all major dashboard and platform routes.
  - Tests skip cleanly when seeded credentials are absent.

### UI-5A — Homework and Timetable Web Admin Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/academics` academic overview hub.
- `/dashboard/homework`.
- `/dashboard/homework/new`.
- `/dashboard/homework/[id]`.
- `/dashboard/timetable`.
- Homework command center.
- Homework create/detail/submissions/reminders UI.
- Timetable command center.
- Weekly grid.
- Versions.
- Weekly requirements.
- Conflicts.
- Substitutions.
- Academic sidebar grouping.
- Typed homework/timetable API helpers.

### UI-5B — Exams, Marks Entry, Results, and Report Cards UX

Status: **Completed / foundation-complete**.

Completed/foundation-complete:

- Exams UX.
- Marks Entry UX.
- Results publishing UX.
- Report Cards UX.
- Academic overview links updated.
- Academic API helpers updated where backend supports endpoints.

### UI-5C — Academic Workflow QA, Browser Smoke Tests, and UX Polish

Status: **Completed**.

Completed:

- Academic navigation/routing hardened.
- Next.js `useRouter` used instead of `window.location` where needed.
- Broken academic sidebar links fixed.
- Loading, empty, confirmation, and validation states improved.
- `api.ts` type safety improved.
- Playwright academic smoke spec added.
- Seed data extended for academic smoke reliability.
- TypeScript verification passed.

### UI-6A — Finance and Accounting UX Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/accounting`.
- `/dashboard/accounting/journals`.
- `/dashboard/accounting/accounts`.
- `/dashboard/accounting/reports`.
- `/dashboard/accounting/reconciliation`.
- `/dashboard/accounting/management`.
- Routed Accounting workspace.
- Old monolithic accounting workspace removed.
- Accounting dashboard, journal entries, chart of accounts, reports views.
- Accounting API helpers added/updated.
- Double-entry guard UX.
- Fiscal period warning UX.
- Posted journal immutability UX.
- Reversal/correction workflow direction.
- Backend-driven accounting reports.

### UI-6B — Payroll and Staff Self-Service UX Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/hr`.
- `/dashboard/hr/staff`.
- `/dashboard/hr/staff/[id]`.
- HR attendance route/view.
- HR leave workflow route/view.
- `/dashboard/payroll`.
- Payroll dashboard.
- Payroll runs lifecycle UI.
- Salary structures UI.
- Payslip management/download UI.
- Payroll reports shell.
- HR and Payroll separated in sidebar.
- 15+ HR/payroll API helpers added/updated.
- Core `@schoolos/core` types used.
- Payroll posting/read-only guards aligned with M9 accounting rules.

## Seed Issue Fix

Status: **Completed**.

Completed:

- `apps/api/prisma/seed.ts` compile errors fixed.
- Subject seed aligned with actual unique key.
- Subject required `type` field fixed.
- ExamTerm seed idempotency fixed.
- Homework seed uses correct Prisma delegate.
- API dev watch no longer blocked by `seed.ts`.

## Remaining Gaps

- HR/Payroll browser smoke tests (deeper coverage).
- Accounting browser smoke tests (improved/partially covered by Phase 2F, but deeper coverage still needed).
- QR-specific Library/Canteen manual QA.
- Platform tenant-action manual QA.
- Payroll PDF/payslip visual polish.
- Staff self-service `/dashboard/my-profile` finalization.
- Staff lifecycle audit logs.
- Journal correction workflow final wiring.
- Trial Balance / Balance Sheet PDF export styling.
- Homework file attachments after File Registry.
- Advanced timetable conflict visualization.
- Library barcode/QR scan polish and Playwright tests.
- Transport live map only after real-time backend design is complete.
- Canteen inventory/vendor UI depth and POS/QR speed polish.
- Full mobile/PWA later.

- pnpm lint: passed
- pnpm typecheck: passed
- pnpm build: passed
- Browser smoke (Phase 2F): Enhanced and verified (credential-gated).
- Manual: Seeded real credentials verified in `seed.ts` logic; environment hardening complete.
- Note: Playwright smoke tests require local port 3000/4000 access which may be restricted in some automated sandboxes; manual local verification recommended.

## Architecture Rules Unchanged

- Keep NestJS modular monolith.
- Keep PostgreSQL with Prisma.
- Keep Redis with BullMQ.
- Keep current Next.js dashboard in `apps/web` for now.
- Do not migrate to Angular yet.
- Do not introduce microservices yet.
- Keep `tenantId` as the tenant/school boundary.

## Verification Notes

This update is documentation-only. Runtime application code is unchanged.

Recommended verification after documentation updates:

```bash
pnpm lint
pnpm typecheck
```
