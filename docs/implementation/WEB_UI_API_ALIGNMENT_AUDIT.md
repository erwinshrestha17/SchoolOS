# SchoolOS Web UI/API Alignment Audit

**Status:** Active implementation audit  
**Date:** 2026-06-19  
**Release stage:** Internal QA ready  
**Scope:** School operations web routes for M1-M10 and the shared authenticated dashboard shell.

This audit records repository truth before the reference-dashboard implementation. The ten supplied reference images are visual specifications only; their sample names, counts, dates, money, progress, and provider states are not production data.

## Shared foundation

The web app already has an authenticated Next.js App Router shell at `components/layout/dashboard-shell.tsx`, permission and entitlement route gates in `app/dashboard/layout.tsx`, role-filtered navigation in `components/layout/sidebar.tsx`, a cookie-first API client in `lib/api/client.ts`, React Query providers, File Registry-backed protected-file actions, and shared loading, empty, error, permission, locked, status, table, filter, header, action-menu, and pagination primitives.

The main foundation gaps are visual alignment and duplication: shared primitives exist under both `components/dashboard` and `components/ui`, several pages compose them differently, the current dark 280px sidebar does not match the light compact reference rail, and the requested contextual side-panel/toolbar/metric-trend/protected-preview composition primitives are absent. New shared components must extend or re-export existing primitives rather than create a third independent system.

## Module alignment

| Module | Existing web routes | Verified backend/API-client coverage | Missing or incomplete alignment |
| --- | --- | --- | --- |
| M1 Admissions & Students | `/dashboard/students`, `/dashboard/students/[studentId]`, `/dashboard/admissions`, `/dashboard/admissions/new`, `/dashboard/admissions/review` | Students/admissions lists and writes; profile/guardian/lifecycle; documents and history; protected preview/download; duplicate review/merge; iEMIS readiness/export; QR generate/status/history/rotate/revoke | No module-owned six-metric overview response. Directory/admissions remain separate primary routes; tabs for Documents, Duplicates, iEMIS, and QR need route/query-state composition. Do not infer missing-document or QR totals from paginated rows. |
| M2 Attendance | `/dashboard/attendance`, `/register`, `/corrections`, `/reports` | Roster, official summary/register/analytics/anomalies, conflicts, corrections, submit/sync/draft, protected register export, staff attendance/leave | Current workspace has five KPIs and three local tabs. Parent-alert count and a purpose-limited offline-draft/conflict summary are not exposed as one overview contract. Teacher selector/scope must remain backend-owned. |
| M3 Fees & Receipts | `/dashboard/finance`, `/collections`, `/invoices`, `/receipts`, `/reversals-refunds`, `/cashier-close`, `/reports`; canonical `/dashboard/fees` compatibility route | Fee heads/plans/invoices/ledger/billing; defaulters/reminders; idempotent collection; refund/reversal; cashier close; receipts/reprints/verification/protected PDF; report snapshots | No single overview contract for all six reference KPIs. Payment screen can use selected real invoice/ledger responses, but total due, overdue, close status, and receipt counts must not be recomputed from partial lists. |
| M4 Academics | `/dashboard/academics` plus exam terms, assessment components, exams, marks, CAS, report cards, results, publishing, locks, promotion | Years/classes/sections/subjects/assignments; exam terms/components/grading policy; marks/batch marks; CAS; report-card generation/correction/history/protected PDF; result readiness/preview/publish | No single overview contract for the six KPI cards. Existing report-card lifecycle is real, but the reference job-progress rail needs confirmed persisted job-state fields before it is represented as asynchronous progress. |
| M5 Activity Feed | `/dashboard/activity`, `/new`, `/moderation`, `/gallery`, `/milestones`, `/[postId]`, `/parent` | Activity posts, moderation, media/file access, consent/audience checks, milestones and parent-scoped feed through `activity-feed` APIs | The reference overview metrics and compose rail need a bounded summary/audience-preview contract. Unsupported post types must stay unavailable; do not render poll/video controls solely from the reference. |
| M6 Homework & Timetable | `/dashboard/homework`, `/new`, `/review`, `/[homeworkId]`; `/dashboard/timetable`, `/builder`, `/conflicts`, `/substitutions`, `/versions`, `/workload` | Homework CRUD/submissions/reminders/attachments; timetable periods/rooms/versions/slots/validation/publish/lock/archive; teacher availability/workload; substitutions | Homework and timetable are separate real workspaces. A combined six-metric overview contract is absent. The combined reference route can compose module APIs, but official totals and conflicts must come from bounded backend summaries. |
| M7 HR & Payroll | `/dashboard/hr`, `/staff`, `/contracts`, `/leave`, `/attendance`; `/dashboard/payroll`, `/runs`, `/payslips`, `/salary-structures`, `/reports` | Staff/lifecycle/contracts/documents; leave/attendance/balances; payroll run lifecycle, preview, summary reports, posting/locking; protected payslips | HR and payroll are separate route layouts. Payroll summary exists, but the complete six-card HR overview and masked selected-payslip rail require composition without exposing salary/bank fields to unauthorized roles. |
| M8 Operations | Library, transport, and canteen each have complete route families under `/dashboard/library`, `/dashboard/transport`, and `/dashboard/canteen` | Library catalog/copies/members/issues/returns/overdue/fines/reports; transport routes/stops/vehicles/assignments/trips/stale-GPS/reports; canteen menu/plans/enrolments/wallet/POS/serving/reports | `/dashboard/operations` does not exist. There is no cross-module operations summary API. The overview may call three purpose-limited module summaries, but it must not deep-fetch unbounded lists or expose allergy details outside canteen permissions. |
| M9 Accounting | `/dashboard/accounting`, `/chart-of-accounts`, `/journals`, `/accounts`, `/reports`, `/reconciliation`, `/fiscal-periods`, `/management`, `/audit` | Accounts/fiscal periods/journals/ledger/reports/exports; M9 mapping/close controls; bank reconciliation and audit APIs | Existing dashboard is broad and real. Reference KPIs need a bounded overview response or explicit unavailable values; export-job status must remain backend job truth. |
| M10 Notices & Communication | `/dashboard/notices`, `/new`, `/deliveries`, `/[noticeId]`; `/dashboard/messages`, `/threads`, `/moderation`, `/[threadId]`; `/dashboard/messaging` | Notices/templates/audience preview/scheduling; delivery logs/analytics/failures/retry; notification center; messaging and parent-teacher chat scope/moderation | `/dashboard/communications` does not exist. Notices, deliveries, and chat can be composed from real APIs. Provider status/diagnostics and the full six-metric overview require a safe provider-health/summary contract; browser timers are prohibited. |

## Permissions and route safety

Permissions are defined in `packages/core/src/permissions/catalog/*` and enforced by backend guards. The dashboard route gate and sidebar already cover the canonical M1-M10 route families. New `/dashboard/operations` and `/dashboard/communications` composition routes need explicit any-of permission gates and matching module entitlement mapping before they can be navigable. Frontend hiding remains UX only.

The audit found no missing permission namespace that justifies inventing a new permission in the shared foundation slice. Module implementation must reuse the existing student, attendance, fee/payment/receipt, academics, activity, homework/timetable, HR/payroll, library, transport, canteen, accounting, notices, communications, and messaging permissions confirmed in `packages/core` and the relevant controllers.

## Frontend data strategy

The current project uses domain API modules in `apps/web/lib/api` and colocated React Query calls in route/workspace components rather than a separate global hook library. That is the existing query strategy and should be preserved. Shared query keys must include server filters and pagination inputs. Growing-list filters should move to URL search parameters where the current route can do so without breaking working flows.

Protected PDFs and files must continue through `openProtectedFile`, `downloadProtectedFile`, `ProtectedFileButton`, or `ProtectedFileLink`. Existing feature-specific helpers for receipts, report cards, payslips, student documents/photos, homework attachments, activity media, and exports must not be replaced by raw URLs or `window.open`.

## Recommended implementation order

1. Standardize the authenticated shell and shared module primitives against the reference geometry while preserving session, RBAC, entitlements, support override, mobile navigation, and current routes.
2. M1, then M2, then M3, then M4, using existing real route contracts and explicit unavailable KPI states where a summary contract is absent.
3. M6 and M7, composing their existing paired workspaces without merging backend domains.
4. Add the M8 operations composition route only after its route gates and bounded submodule summaries are confirmed or added.
5. Refine M9 using its existing accounting dashboard and job/reconciliation contracts.
6. M5, then M10; add `/dashboard/communications` only as a composition route over notices/delivery/chat contracts with a safe provider-status gap state.
7. For every slice, update focused contract tests, run web lint/typecheck/tests, and perform authenticated browser visual QA at the reference desktop size plus tablet/mobile fallbacks.

## Current risks and deliberate deferrals

- The repository is Internal QA ready, not staging validated or GA.
- The supplied screenshots contain illustrative data and cannot be used as seed or fallback production truth.
- Combined overview KPIs are deferred until backed by bounded module-owned summaries; unavailable states are the correct interim UI.
- Authenticated browser fidelity evidence requires a running API, seeded tenant, and credentials. Public-only Playwright results do not satisfy that gate.
- No backend, Prisma, permission, or OpenAPI change is justified by the shared-foundation audit alone.

## Implementation checkpoint

The source implementation completed the shared shell and the M1-M10 overview alignment without changing backend, Prisma, OpenAPI, or permission contracts. Existing business workflows remain on their canonical routes; the new overview routes compose existing purpose-limited APIs and use explicit unavailable states for unsupported official metrics.

### Shared system

- Reworked the authenticated dashboard rail and page spacing to the compact light reference geometry while preserving session, support-override, RBAC, entitlement, and mobile-navigation behavior.
- Standardized the primary-action-first module header and reference-style metric cards.
- Added shared dashboard exports/primitives for module headers, KPI cards, filter and table toolbars, context panels, status badges, pagination, trends, protected previews, action menus, and permission states.
- Preserved the cookie-first API client and File Registry-backed protected-file helpers; no raw private-file route was introduced.

### Module and route coverage

| Module | Implemented overview alignment | Current contract result |
| --- | --- | --- |
| M1 | `/dashboard/students` | Active students, pending applications, and iEMIS issues use existing bounded responses; missing-document, duplicate-candidate, and QR-active totals remain unavailable. |
| M2 | `/dashboard/attendance` | Existing analytics, anomaly, correction, and conflict contracts remain wired; parent-alert totals remain unavailable. |
| M3 | `/dashboard/finance` | Defaulter count and outstanding value use the backend report; collected-today, total-due, close-status, reversal, and receipt totals remain unavailable where no overview contract exists. |
| M4 | `/dashboard/academics` | Existing exam, marks, CAS, report-card, result, and protected-file workflows remain linked; all six overview totals remain unavailable pending a bounded summary. |
| M5 | `/dashboard/activity`, `/dashboard/activity/reports` | Existing feed workflows remain real; misleading list-length KPI calculations were removed, and reporting is a friendly unavailable state pending a safe report API. |
| M6 | `/dashboard/homework` | Homework report rows back assigned and pending values; due-soon and timetable overview values remain unavailable while canonical timetable routes stay linked. |
| M7 | `/dashboard/hr` | Pending leave and expiring-contract summaries use backend responses; broader staff/payroll totals remain unavailable or permission-restricted. |
| M8 | `/dashboard/operations` | New permission-scoped composition route uses library overdue, transport reports/stale GPS, and canteen meal/low-balance APIs. No allergy details are exposed. |
| M9 | `/dashboard/accounting` | Fiscal status and trial-balance readiness use backend truth; journal/reconciliation/mapping/export-job totals remain unavailable pending bounded summaries. |
| M10 | `/dashboard/communications` plus `/recipients`, `/templates`, `/provider-diagnostics` | New permission-scoped composition route uses notices, delivery failures, and chat escalation summaries. Unsupported provider diagnostics and recipient/template overview surfaces fail honestly without exposing provider internals. |

The new `/dashboard/operations` and `/dashboard/communications` entries have matching dashboard route gates and sidebar visibility. Existing `/dashboard/library`, `/dashboard/transport`, `/dashboard/canteen`, `/dashboard/notices`, and `/dashboard/messages` workflows remain canonical and unchanged.

### Verification evidence

- `pnpm --filter @schoolos/web lint` — passed.
- `pnpm --filter @schoolos/web typecheck` — passed.
- `node --test apps/web/test/*.test.mjs` through the web test script — 172 passed, 0 failed.
- `pnpm --filter @schoolos/web build` — passed; 160 static pages generated and the new operations, communications, and activity-report routes were included.
- `git diff --check` — passed.

Authenticated rendered QA is not complete. The local Next.js server started successfully, but the in-app browser rejected navigation to `127.0.0.1` under the active browser security policy. No alternate browser workaround was used, and no screenshot-fidelity claim is recorded.

## Manual QA route list

At a minimum, validate these overview routes with seeded, permission-varied accounts at the supplied desktop viewport and responsive tablet/mobile widths:

1. `/dashboard/students`
2. `/dashboard/attendance`
3. `/dashboard/finance`
4. `/dashboard/academics`
5. `/dashboard/activity`
6. `/dashboard/homework`
7. `/dashboard/hr`
8. `/dashboard/operations`
9. `/dashboard/accounting`
10. `/dashboard/communications`

For each route, capture loading, empty, populated, permission-denied, module-locked, backend-error, protected-file-unavailable, and responsive-navigation evidence where applicable. Exercise the canonical linked workflows rather than treating the overview cards as substitutes for their business flows.

## Follow-up plan

### P1 — required before this slice can be called visually complete

1. Run authenticated browser QA against a seeded local or staging tenant when the browser policy permits the target URL.
2. Compare all ten overview routes against their supplied references at the reference viewport, then correct verified spacing, overflow, focus, keyboard, and responsive defects.
3. Add bounded, module-owned overview APIs only for recurring operational decisions that cannot be represented honestly with existing responses; update OpenAPI, shared contracts, permissions, query tests, and tenant-scoped index review together.
4. Add focused authenticated browser coverage for the two new composition routes and their permission/module-lock states.

### P2 — refinement after P1 evidence

1. Move growing-list filter state to URL search parameters where the current canonical workspace still keeps it locally.
2. Add persisted backend job-state presentation for report-card, accounting-export, and other long-running work only after those job contracts are confirmed.
3. Consolidate remaining duplicated dashboard primitives into the shared system without rewriting stable module workflows.
4. Capture staging provider, protected-download, device-width, observability, rollback, and controlled-pilot evidence under the GA release policy; local source checks do not satisfy those gates.
