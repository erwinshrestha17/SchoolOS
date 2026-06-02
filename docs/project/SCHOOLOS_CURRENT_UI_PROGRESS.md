# SchoolOS Current UI Progress

This file records the latest web-admin UI/UX implementation progress so large roadmap files do not need broad rewrites for every sprint update.

## Current UI Sprint

```text
Current UI sprint: backend M0-M10 local hardening and the admin web global polish pass are implemented for the current modular-monolith scope. Latest UI depth includes dashboard shell polish, accounting audit context, transport freshness, Library/Canteen scanner-first QR flows, report-card correction review, and app-controlled toasts/confirmation dialogs across operator workflows; next work is staging/browser QA and provider/production-gated checks.
```

Current repo reality:

```text
Academics, Accounting, Homework, Timetable, HR, Payroll, Library, Transport, and Canteen now have admin production-depth coverage for the current modular-monolith scope.
Platform settings now has provider readiness detail and queue failed-job detail surfaces wired to real APIs.
M10 notice composition now supports File Registry attachments through real upload APIs, and the delivery retry panel consumes the backend failed-delivery dashboard.
Dashboard protected routes now have direct URL permission-denied gating and slow-session retry/sign-in recovery.
Flutter parent attendance now uses the purpose-limited mobile attendance API and selected-child state instead of admin-shaped attendance endpoints.
Flutter teacher attendance now uses purpose-limited mobile teacher class, roster, and submit endpoints that reuse backend teacher-scope attendance validation.
Flutter notifications now read from `/mobile/me/notifications`, mark notification deliveries read through the mobile read endpoint, and map backend source families into mobile categories.
Flutter staff self-service now has backend-backed profile, attendance, leave, and payslip screens using `/staff/me`, `/attendance/me/*`, and `/payroll/me/payslips`, plus payslip PDF download/share through the backend payroll PDF endpoint.
HR staff detail now has a backend-backed lifecycle Audit tab using `/hr/staff/:staffId/history`.
Dashboard overview now routes fee alerts to the canonical Fees workspace, uses clearer alert/queue/delivery metrics, and exposes a keyboard-accessible skip link in the dashboard shell.
Accounting audit now has summary cards, richer log-detail fields, and explicit loading/empty states.
Transport latest-location operators now get Fresh/Delayed/Stale location context before inspecting trip location records.
Operator feedback no longer depends on browser-native `alert()` or `confirm()` calls anywhere under `apps/web/app` or `apps/web/components`; destructive and high-impact actions use shared `ConfirmDialog`, while results/errors use `Toast` or inline state.
Next UI work is browser/staging QA for authenticated dashboard routes, delivery failures, retry/resend, QR/POS scan speed, provider/queue mutation states, and permission/error states.
```

### UI-7B - Global Admin Polish and App-Controlled Feedback

Status: **Implemented locally; authenticated staging/browser smoke still required.**

Completed:

- Dashboard shell now includes a visible-on-focus skip link, sharper card radius, readable section/stat typography, and the overdue-fees dashboard action points to `/dashboard/fees`.
- Accounting audit workspace now surfaces record/page/filter context through summary cards and shows richer action/resource/actor/timestamp/tenant fields in the audit detail dialog.
- Transport latest-location workflow now shows selected-trip freshness state with Fresh, Delayed, Stale, and No ping messaging.
- Library issue and Canteen serving/POS workflows now use scanner-first copy/student QR context, recent scan feedback, wallet/allergy/spending warnings, and submit gating.
- Academics exam terms, assessment components, marks lock requests, legacy report-card generation, promotion, and result publishing now use in-app toasts plus shared confirmation dialogs.
- Homework cancel/reminder/file-open actions, admissions document/ID-card/checklist actions, staff payslip downloads, student photo removal, and platform subscription cancellation now use app-controlled feedback.
- Added a web contract that rejects future `alert()`/`confirm()` usage in `apps/web/app` and `apps/web/components`.

Verification:

- `pnpm --filter @schoolos/web test -- web-contracts.test.mjs` passed with 107 tests.
- `pnpm --filter @schoolos/web typecheck` passed.
- Targeted ESLint passed for the global polish files touched in this sprint.

### M10 and Extended Operations Feature-Depth Pass

Status: **Implemented; final local/staging smoke still required.**

Completed:

- Notice composer now uploads a protected File Registry attachment and passes the attachment file id to the real notice API.
- Delivery retry UI now reads backend failure dashboard data including retry count, retry status, last failure reason, and recipient summary.
- Flutter notification center now consumes the purpose-limited mobile notification center and marks read state through the backend mobile endpoint.
- Flutter teacher attendance now loads assigned classes/rosters and submits non-present exceptions through mobile teacher attendance APIs instead of returning an empty mobile roster.
- M5 activity cards/detail views now show a consent-aware hidden-media state instead of exposing blocked private media.
- M5 has a parent activity feed foundation backed by the real `/activity-feed/parent` API.
- M6 homework/timetable backend role depth now fails closed for parent/student homework assignment and submission queries that are not linked to the requested student.
- M7 payroll backend reports now expose explicit register, PF, TDS, and salary-component summaries instead of thin aliases.
- Flutter staff self-service now shows synced staff attendance, leave requests, and payslips rather than static staff dashboard placeholders, including mobile payslip PDF download/share actions.
- M8A Library admin depth now has tests for fine-to-fees/accounting boundary, staff borrowers, and purpose-limited QR lookup.
- M8C Canteen backend/admin depth now exposes a POS receipt endpoint and prevents wallet reversals/corrections from making balances negative.
- M8C Canteen meal-plan enrollment now creates linked M3 fee invoices through backend FinanceService/M9 posting boundaries, and the enrollments UI shows the linked invoice marker.
- M8C POS now has backend-protected receipt preview and PDF reprint actions in the admin canteen workspace.
- M8C inventory now uses real supplier, inventory item, purchase bill, wastage, manual stock-adjustment, and stock ledger APIs for admin list/create, operation posting, and visibility surfaces.
- M10 parent-teacher messaging now shows an admin moderation decision panel with thread status, priority/unread counts, explicit concern/moderation/escalation reason fields, and close/escalate success notices.
- M10 notice detail unread-recipient panel now has guardian/student/contact search, channel/class filters, follow-up queue summary, failed-delivery count, and contact-cleanup cues.
- M3 collection counter dues table now supports fee-head and billing-period filters plus line-level quick-fill collection amounts while keeping overpayment guards in the existing payment flow.
- M8A Library issue flow now has scanner-first copy barcode/QR lookup, QR borrower status context, recent scan feedback, available-copy selection, and real form validation for due dates.
- Shared QR resolver now normalizes canteen POS/serving scan aliases to the backend-supported `CANTEEN` purpose and normalizes `studentId` into `id` for scanner callers.
- M8C Canteen serving and POS now show QR scan result cards with wallet status, allergy warnings, spending warnings, correct serving/POS student preview queries, and POS submit gating for student/item/quantity readiness.
- M8B Transport backend/admin depth now guards GPS ingestion pressure, verifies Redis latest-location/cache fanout, and bounds retention cleanup.

Deferred:

- Full parent/mobile portal.
- Driver app.
- Production live transport map.
- AI/ML/M11.
- Biometric workflows.

### M0 Platform Provider and Queue Hardening

Status: **Implemented; final verify:production rerun is environment-blocked in this sandbox.**

Completed:

- Added a provider readiness detail flow on Platform Settings that uses real platform APIs.
- Surfaced masked provider readiness status, missing non-secret configuration keys, disabled-mode warnings, and object-storage dry-run readiness without triggering paid external calls.
- Added queue failed-job detail inspection with sanitized job payload, failed reason, timestamps, stack trace, and retry audit history.
- Kept provider secret values masked and did not expose raw credentials in UI responses.
- Added web contract coverage for provider readiness and queue job detail affordances.

Verification:

- `pnpm --filter @schoolos/web test` passed.
- Full repo `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` passed after this M0 UI/API change.
- `pnpm verify:production` is blocked only when Playwright tries to bind `127.0.0.1:3101` in the current sandbox.

### M0 Platform Subscription Plan Change Workflow

Status: **Completed**.

Completed:

- Wired the Platform School Detail **Change Plan** action to `/platform/schools/[tenantId]/change-plan`.
- Updated the change-plan page to use shared API helpers for tenant detail, platform plans, and tenant subscription assignment.
- Added current-plan versus new-plan preview, effective/renewal date visibility, readable success/error states, and guarded submit behavior requiring an audit reason.
- Kept the billing boundary explicit: this is SchoolOS SaaS subscription billing only and does not create student fee invoices or post to tenant M9 Accounting.
- Added web contract coverage and a platform smoke assertion for the change-plan workflow.

### M0 Platform Operator Workflow Completion

Status: **Completed**.

Completed:

- Tenant detail support override now opens a reasoned, time-bound **Enter Support Mode** dialog backed by the platform support override API.
- Tenant SaaS billing now supports invoice creation, invoice detail viewing, payment recording, invoice cancellation, and billing profile editing through real platform APIs.
- Tenant onboarding now has a full checklist dialog and audited item override workflow.
- Tenant and global audit views now expose richer filters and clearly labelled **Export current page CSV** behavior.
- Platform settings now supports provider edit, provider disable through a status-only audited endpoint, inline provider test results, queue retry reason dialogs, and queue discard confirmation.
- Platform settings sidebar deep-links now select the intended tab, and fake infrastructure telemetry has been replaced with a not-configured state.

## Current Sprint (Completed)

### UI-7A — Phase 3 Operational Hardening: Homework, Timetable, HR, and Payroll

Status: **Completed**.

Focus: Hardening the operational depth for Phase 2 foundations to support daily coordinator, teacher, and HR/Accounting workflows.

Completed:

- **Timetable & Substitution Oversight:**
  - Added a **Substitutions Tab** to the Timetable Workspace for daily coverage tracking.
  - Implemented a **Substitution Summary Panel** showing aggregate metrics (Absent Teachers, Pending Subs).
  - Enhanced the Timetable Builder grid to **visually highlight conflicting slots** (e.g., teacher absence conflicts in red).
- **Teacher Dashboard (Faculty View):**
  - Implemented a specialized **Teacher Insights** section on the main dashboard.
  - Added "Today's Classes" and "Homework Review" widgets for rapid faculty access.
- **HR & Payroll Integrity:**
  - Refined the Payroll Dashboard with a **Status Stepper** (Draft -> Approved -> Posted -> Paid).
  - Implemented **Payroll Reversal UI** for audit-compliant correction workflows.
  - Enabled secure **PDF Payslip** access from the staff detail and payroll lines.
  - Integrated **PII Masking** for sensitive staff fields (Bank, PAN, Identity) based on permissions.
- **Homework UX:**
  - Polished the Homework Detail page with attachment previews and download support.
  - Integrated the **Homework Review Modal** for batch grading and feedback.

### UI-6F — Academics and Accounting Production Polish

Status: **Completed**.

Focus: Completing the highest-value admin production surfaces for M4 Academics and M9 Accounting.

Completed:

- **Academics Report Cards:**
  - Added clearer report-card status, PDF download, generation history, and correction/regeneration actions.
  - Moved locked report-card correction/regeneration into an explicit review dialog with selected report context and audited reason entry.
  - Added readable loading, empty, and error states around report-card generation/download flows.
  - Updated Academics Playwright smoke coverage for exams, marks, CAS, results, report cards, download visibility, and history.
- **Accounting Reports:**
  - Added PDF export actions for backend-supported accounting reports.
  - Added saved snapshot/history panel backed by report export history.
  - Preserved backend financial truth: UI triggers exports and displays backend totals, but does not calculate official totals.
- **Bank Reconciliation:**
  - Added an auto-match suggestion action and review-only suggestion panel.
  - Low-confidence and duplicate suggestions are surfaced for manual review instead of automatic reconciliation.
- **Verification:**
  - Web typecheck and full repo tests passed.
  - Browser E2E execution is blocked in the current sandbox by local-port binding restrictions and must be rerun in local/staging.

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
run credential-gated browser smoke in local/staging, permission-denied states, stale link cleanup, QR manual QA, and accounting audit viewer depth.
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
- Staff detail lifecycle Audit tab.
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

- [ ] HR/Payroll browser smoke tests (deeper coverage in staging).
- [ ] Accounting browser smoke tests (deeper coverage in staging).
- [ ] QR-specific Library/Canteen manual QA.
- [ ] Platform tenant-action manual QA.
- [x] Platform API key management UI.
- [x] Platform webhook registry/history UI.
- [x] Payroll PDF/payslip visual polish.
- [x] Staff self-service `/dashboard/my-profile` finalization (PDF slips).
- [x] Staff lifecycle audit logs in HR staff detail.
- [x] Payroll posting boundary final wiring (payment/reversal actions remain outside the Phase 2 UI).
- [x] Trial Balance / Balance Sheet PDF export styling with control-total summary cards.
- [x] Homework file attachments after File Registry.
- [x] Advanced timetable conflict visualization.
- [x] Credential-gated Phase 4 Library/Canteen/Transport Playwright smoke coverage.
- [x] Library barcode/QR scan polish beyond current admin scan/report surfaces.
- [ ] Transport live map only after admin real-time readiness is product-approved.
- [x] Canteen purchase-bill/wastage/manual-adjustment UI depth beyond current supplier/item list-create and stock-ledger surfaces.
- [x] Canteen POS/QR speed polish beyond current routes.
- [ ] Canteen meal-plan cancellation/void and collection-link UX after product rules are finalized.
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
