# SchoolOS Web UI/API Alignment Audit

**Status:** Active implementation audit  
**Date:** 2026-06-19  
**Release stage:** Internal QA ready  
**Scope:** School operations web routes for M1-M10, the shared authenticated dashboard shell, and M3 Fees & Receipts reference-to-contract alignment.

This audit records repository truth before and during reference-dashboard alignment. The supplied reference images are visual specifications only; their sample names, counts, dates, money, progress, and provider states are not production data.

## Shared foundation

The web app already has an authenticated Next.js App Router shell at `components/layout/dashboard-shell.tsx`, permission and entitlement route gates in `app/dashboard/layout.tsx`, role-filtered navigation in `components/layout/sidebar.tsx`, a cookie-first API client in `lib/api/client.ts`, React Query providers, File Registry-backed protected-file actions, and shared loading, empty, error, permission, locked, status, table, filter, header, action-menu, and pagination primitives.

The main foundation gaps are visual alignment and duplication: shared primitives exist under both `components/dashboard` and `components/ui`, several pages compose them differently, the current dark 280px sidebar does not match the light compact reference rail, and the requested contextual side-panel/toolbar/metric-trend/protected-preview composition primitives are absent. New shared components must extend or re-export existing primitives rather than create a third independent system.

## Module alignment

| Module | Existing web routes | Verified backend/API-client coverage | Missing or incomplete alignment |
| --- | --- | --- | --- |
| M1 Admissions & Students | `/dashboard/students`, `/dashboard/students/[studentId]`, `/dashboard/admissions`, `/dashboard/admissions/new`, `/dashboard/admissions/review` | Students/admissions lists and writes; profile/guardian/lifecycle; documents and history; protected preview/download; duplicate review/merge; iEMIS readiness/export; QR generate/status/history/rotate/revoke | No module-owned six-metric overview response. Directory/admissions remain separate primary routes; tabs for Documents, Duplicates, iEMIS, and QR need route/query-state composition. Do not infer missing-document or QR totals from paginated rows. |
| M2 Attendance | `/dashboard/attendance`, `/register`, `/corrections`, `/reports` | Roster, official summary/register/analytics/anomalies, conflicts, corrections, submit/sync/draft, protected register export, staff attendance/leave | Current workspace has five KPIs and three local tabs. Parent-alert count and a purpose-limited offline-draft/conflict summary are not exposed as one overview contract. Teacher selector/scope must remain backend-owned. |
| M3 Fees & Receipts | `/dashboard/finance`, `/collections`, `/invoices`, `/receipts`, `/reversals-refunds`, `/cashier-close`, `/reports`; canonical `/dashboard/fees` compatibility route | Fee heads/plans/invoices/ledger/billing; defaulters/reminders; idempotent collection; refund/reversal; cashier close; receipts/reprints/verification/protected PDF; report snapshots | The M3 reference slice is now documented below. No single overview contract exists for all visual KPI cards. Payment screen can use selected real invoice/ledger responses, but total due, overdue, close status, and receipt counts must not be recomputed from partial lists. New visual concepts remain unavailable until backend/OpenAPI contracts exist. |
| M4 Academics | `/dashboard/academics` plus exam terms, assessment components, exams, marks, CAS, report cards, results, publishing, locks, promotion | Years/classes/sections/subjects/assignments; exam terms/components/grading policy; marks/batch marks; CAS; report-card generation/correction/history/protected PDF; result readiness/preview/publish | No single overview contract for the six KPI cards. Existing report-card lifecycle is real, but the reference job-progress rail needs confirmed persisted job-state fields before it is represented as asynchronous progress. |
| M5 Activity Feed | `/dashboard/activity`, `/new`, `/moderation`, `/gallery`, `/milestones`, `/[postId]`, `/parent` | Activity posts, moderation, media/file access, consent/audience checks, milestones and parent-scoped feed through `activity-feed` APIs | The reference overview metrics and compose rail need a bounded summary/audience-preview contract. Unsupported post types must stay unavailable; do not render poll/video controls solely from the reference. |
| M6 Homework & Timetable | `/dashboard/homework`, `/new`, `/review`, `/[homeworkId]`; `/dashboard/timetable`, `/builder`, `/conflicts`, `/substitutions`, `/versions`, `/workload` | Homework CRUD/submissions/reminders/attachments; timetable periods/rooms/versions/slots/validation/publish/lock/archive; teacher availability/workload; substitutions | Homework and timetable are separate real workspaces. A combined six-metric overview contract is absent. The combined reference route can compose module APIs, but official totals and conflicts must come from bounded backend summaries. |
| M7 HR & Payroll | `/dashboard/hr`, `/staff`, `/contracts`, `/leave`, `/attendance`; `/dashboard/payroll`, `/runs`, `/payslips`, `/salary-structures`, `/reports` | Staff/lifecycle/contracts/documents; leave/attendance/balances; payroll run lifecycle, preview, summary reports, posting/locking; protected payslips | HR and payroll are separate route layouts. Payroll summary exists, but the complete six-card HR overview and masked selected-payslip rail require composition without exposing salary/bank fields to unauthorized roles. |
| M8 Operations | Library, transport, and canteen each have complete route families under `/dashboard/library`, `/dashboard/transport`, and `/dashboard/canteen` | Library catalog/copies/members/issues/returns/overdue/fines/reports; transport routes/stops/vehicles/assignments/trips/stale-GPS/reports; canteen menu/plans/enrolments/wallet/POS/serving/reports | `/dashboard/operations` does not exist. There is no cross-module operations summary API. The overview may call three purpose-limited module summaries, but it must not deep-fetch unbounded lists or expose allergy details outside canteen permissions. |
| M9 Accounting | `/dashboard/accounting`, `/chart-of-accounts`, `/journals`, `/accounts`, `/reports`, `/reconciliation`, `/fiscal-periods`, `/management`, `/audit` | Accounts/fiscal periods/journals/ledger/reports/exports; M9 mapping/close controls; bank reconciliation and audit APIs | Existing dashboard is broad and real. Reference KPIs need a bounded overview response or explicit unavailable values; export-job status must remain backend job truth. |
| M10 Notices & Communication | `/dashboard/notices`, `/new`, `/deliveries`, `/[noticeId]`; `/dashboard/messages`, `/threads`, `/moderation`, `/[threadId]`; `/dashboard/messaging` | Notices/templates/audience preview/scheduling; delivery logs/analytics/failures/retry; notification center; messaging and parent-teacher chat scope/moderation | `/dashboard/communications` does not exist. Notices, deliveries, and chat can be composed from real APIs. Provider status/diagnostics and the full six-metric overview require a safe provider-health/summary contract; browser timers are prohibited. |

## M3 Fees & Receipts reference-screen implementation slice

### Scope and status

The supplied M3 references establish the desired desktop operating-desk composition for fees and collections. They do not authorize new API shapes, routes, permissions, financial calculations, provider states, or seeded data.

This section records the approved visual and workflow direction for implementation against existing M3 contracts. The canonical web design plan remains authoritative for shared UI rules. Backend controllers, OpenAPI, and shared contracts remain authoritative for fields, status values, totals, actor permissions, and mutation behavior.

### M3 screen map

| Reference work area | Primary SchoolOS route or canonical workspace | Main job | Contract-safe implementation requirement |
| --- | --- | --- | --- |
| Fees overview | `/dashboard/finance` with canonical `/dashboard/fees` compatibility | Direct the accountant or finance manager to current collections, invoices, defaulters, and close-of-day work. | Show only bounded backend values. Keep unsupported KPI cards explicitly unavailable; do not calculate official values from invoice or receipt list pages. |
| Fee structures, plans, and billing setup | Existing fee-plan and billing workflow under the finance domain; exact web route needs route/code confirmation. | Configure class/section applicability, fee components, installments, concessions, and billing cycle. | Use existing fee-plan APIs only. A visual component breakdown, mapped-student total, or installment preview requires an existing bounded response; otherwise omit or show an honest unavailable state. |
| Student invoices | `/dashboard/finance/invoices` | Review, issue, filter, and select invoices. | Use server pagination/filtering. Show selection and batch actions only where the existing API and permissions support them. |
| Invoice detail | Existing invoice detail workflow or selected-record rail; exact route needs code/OpenAPI confirmation. | Inspect line items, adjustments, allocations, related receipts, documents, and audit history. | Prefer a full route when audit, allocation history, protected PDFs, or high-risk actions require deep context. Never expose client-calculated grand totals. |
| Collect payment | `/dashboard/finance/collections` | Search one student, choose payable invoices, collect full or partial payment, and issue a receipt. | Use a transaction-workbench layout with backend-authoritative selected invoice/outstanding values, duplicate-safe submit state, receipt only after confirmed success, and idempotency protection. |
| Receipt detail and reprint | `/dashboard/finance/receipts` | Inspect payment allocations, receipt status, delivery/reprint history, and receipt PDF. | Use authenticated File Registry helpers for preview/download/print/share. Reprint and share actions remain audited and permission-gated. |
| Defaulters and due reminders | Existing finance defaulter/reminder workspace; exact web route/tab needs code confirmation. | Prioritize overdue accounts and preview safe reminder follow-up. | Use server-provided aging buckets, overdue days, assigned staff, and totals. Recipient preview and send/retry actions require existing backend delivery/approval behavior. |
| Discounts, scholarships, and waivers | Existing finance adjustment workflow; exact web route/tab needs code confirmation. | Review/approve concession requests and apply permitted fee adjustments. | Require role/permission, reason, fee-head scope, backend validation, and paid/void invoice denial. Never create a browser-only concession calculation. |
| Refunds and reversals | `/dashboard/finance/reversals-refunds` | Review refund/reversal requests, approvals, and audit trail. | Confirmed financial records must use reversal/correction workflows. Reject/approve/reverse states require a reason and audit support; do not imply instant approval without contract support. |
| Cashier close and reconciliation | `/dashboard/finance/cashier-close` | Verify receipts, cash/digital/manual-method totals, counted cash, variance, and close readiness. | Respect backend method-specific close isolation and unique-window rules. The close summary must use backend truth; a cash variance reason is required wherever backend policy requires it. |
| Reports and analytics | `/dashboard/finance/reports` | Review fee, collection, due, and payment-method reports. | Use backend report totals and retained File Registry artifacts. Long-running exports need queued/processing/completed/failed presentation only where job state is exposed. |

### M3 desktop composition rules

1. Keep the stable shell visible: topbar, school and academic-year context, left navigation, module header, context filters, KPI strip, main work area, and right rail only where the rail has an active finance job.
2. Use one primary header action per screen. On the overview and invoices screens, the primary action is `Record Payment` or the existing equivalent. Exports, templates, issue actions, and other secondary work belong in `More Actions` unless a dedicated workflow makes them the primary job.
3. The reference right rail is meaningful only for selected record context, transaction workbench state, pending approval context, or protected artifact preview. It must have loading, empty, error, permission-denied, and collapse behavior.
4. Make the collection screen the strongest M3 workbench. Its three visual areas are: student/invoice selection; payment entry and allocation; backend-derived summary/receipt outcome.
5. Use full detail routes for invoices, receipts, refunds/reversals, and cashier close whenever audit, protected documents, or multi-step confirmation would become unsafe in a narrow drawer.
6. Use compact status chips with text labels. `Paid`, `Partial`, `Overdue`, `Draft`, `Pending Review`, `Reversed`, `Rejected`, `Submitted`, and `Closed` must only appear when backed by the relevant backend enum/contract.
7. Keep M3 and M9 separate. M3 runs school fee collection and its operational follow-up; M9 owns accounting journals, fiscal controls, and accounting reconciliation records.

### Collect-payment workbench

The collection reference should be implemented as a cashier-first workflow, not a generic form.

```text
Header: Collect Payment
Context: collection date | cashier | student | counter/session where the backend provides it

Left: student search + selected student + unpaid/partial invoices
Centre: amount received + backend-validated allocation + payment method + reference + payer + notes
Right: backend-authoritative payment summary + receipt preview after confirmation + outstanding balance
Footer: allocation preview / validation / submit state
```

Required behavior:

- Search only through the existing supported student, invoice, receipt, admission-number, or guardian-phone contracts.
- Load selected invoice details before enabling amount allocation.
- Do not calculate official allocated, remaining, receipt, or ledger totals with JavaScript floating point arithmetic.
- Keep `isSubmitting` or equivalent duplicate-click protection visible.
- Pass and preserve the backend idempotency behavior already used by the payment flow.
- Show receipt actions only after backend confirmation and use protected file helpers for print/download/share.
- Keep cash, digital, bank transfer, cheque, manual reference, and future gateway options conditional on backend-supported payment methods and provider readiness.
- Block offline financial writes and do not present browser-held drafts as confirmed payment.

### Financial safety and state requirements

Every M3 screen must show an honest state for:

| Situation | Required UI behaviour |
| --- | --- |
| Summary metric is not exposed by a bounded backend response | Show `Unavailable` or omit the card; never infer it from a partial list. |
| Payment request pending | Disable duplicate submission, preserve entered fields where safe, and show a clear pending state. |
| Duplicate/idempotent replay | Resolve through backend response; show the existing receipt/payment result rather than a generic failure. |
| Invoice no longer payable, paid, void, or cross-tenant | Show safe backend error wording and refresh the selected invoice context. |
| Gateway/provider not validated or unavailable | Do not expose a working payment option. Explain that the method is unavailable and keep non-gateway workflows unaffected. |
| Refund/reversal requires approval | Show request status, reviewer/approver context only where permitted, required reason, and audit timeline. |
| Cashier close overlap or already-closed method/window | Show the current close context and block unsafe repeat close actions. |
| Cash variance | Use backend expected/count values, require a reason where policy requires it, and show that the record is not silently reconciled. |
| Protected receipt, close PDF, or report unavailable | Use a safe file-unavailable/retry state; never surface a storage URL, object key, or provider detail. |
| Large report/export | Show job status only when the backend exposes it; otherwise keep report request/download actions within the existing synchronous contract. |

### Contract and verification boundaries

No new M3 endpoint, permission, enum, or database field is approved by this visual slice. Mark the following as `needs backend verification` or `needs OpenAPI confirmation` before implementation when they are not already present in the current codebase:

- A single daily M3 overview response for collection, invoices, receipts, close status, reversal count, and outstanding total.
- Fee-plan component distribution, mapped-student totals, and installment schedule preview.
- Invoice detail route shape, allocation history payload, and any bulk invoice issue/void action.
- Reminder campaign recipient preview, delivery status, retry reason, and bulk follow-up controls.
- Approval queue payloads for concessions, waivers, refunds, and reversals.
- Cashier-close counter/session fields, per-method totals, variance reasons, close timeline, and approval/reopen presentation.
- Payment-method mix, collection trend, and ageing analytics visualizations.
- Report job progress, retained export history, and scheduled export controls.

When a contract is absent, retain the existing operational workspace, present an unavailable state, or add a backend slice first with tenant scoping, RBAC, entitlement checks, audit behavior, tests, OpenAPI, and financial idempotency as applicable.

### M3 focused verification plan

Before marking an M3 reference screen complete, verify:

1. A cashier can collect a payment only for tenant-scoped selectable invoices, sees the duplicate-safe pending state, and receives the confirmed receipt result.
2. A cashier without reversal/refund permission cannot access those actions through navigation, direct URL, or mutation attempt.
3. Invoice, receipt, defaulter, concession, refund/reversal, and close lists use server pagination/filtering where they can grow.
4. Every financial total and status comes from the backend; no KPI or allocation derives truth from a browser-side `reduce`, list length, or floating-point sum.
5. Receipt, close, and report files use protected helpers, including loading, unavailable, expired, permission-denied, and retry states.
6. Refund/reversal, adjustment, concession, and close actions surface confirmation, required reason, pending/success/error state, and audit context.
7. Cashier close honors backend method-specific close isolation and rejects duplicate same-window submissions safely.
8. Gateway UI remains disabled/unavailable until validated sandbox/staging readiness is returned by backend; no client fallback marks an invoice as paid.
9. Authenticated browser QA covers populated, empty, error, forbidden, module-locked, payment-pending, file-unavailable, and responsive right-rail/drawer states.

## Permissions and route safety

Permissions are defined in `packages/core/src/permissions/catalog/*` and enforced by backend guards. The dashboard route gate and sidebar already cover the canonical M1-M10 route families. New `/dashboard/operations` and `/dashboard/communications` composition routes need explicit any-of permission gates and matching module entitlement mapping before they can be navigable. Frontend hiding remains UX only.

The audit found no missing permission namespace that justifies inventing a new permission in the shared foundation slice. Module implementation must reuse the existing student, attendance, fee/payment/receipt, academics, activity, homework/timetable, HR/payroll, library, transport, canteen, accounting, notices, communications, and messaging permissions confirmed in `packages/core` and the relevant controllers.

## Frontend data strategy

The current project uses domain API modules in `apps/web/lib/api` and colocated React Query calls in route/workspace components rather than a separate global hook library. That is the existing query strategy and should be preserved. Shared query keys must include server filters and pagination inputs. Growing-list filters should move to URL search parameters where the current route can do so without breaking working flows.

Protected PDFs and files must continue through `openProtectedFile`, `downloadProtectedFile`, `ProtectedFileButton`, or `ProtectedFileLink`. Existing feature-specific helpers for receipts, report cards, payslips, student documents/photos, homework attachments, activity media, and exports must not be replaced by raw URLs or `window.open`.

## Recommended implementation order

1. Standardize the authenticated shell and shared module primitives against the reference geometry while preserving session, RBAC, entitlements, support override, mobile navigation, and current routes.
2. M1, then M2, then M3, then M4, using existing real route contracts and explicit unavailable KPI states where a summary contract is absent.
3. Implement the M3 cashier-first collection workbench, invoice/receipt contextual details, due follow-up, adjustment/approval, cashier close, and report states in the screen order described above without changing backend contracts solely for visual parity.
4. M6 and M7, composing their existing paired workspaces without merging backend domains.
5. Add the M8 operations composition route only after its route gates and bounded submodule summaries are confirmed or added.
6. Refine M9 using its existing accounting dashboard and job/reconciliation contracts.
7. M5, then M10; add `/dashboard/communications` only as a composition route over notices/delivery/chat contracts with a safe provider-status gap state.
8. For every slice, update focused contract tests, run web lint/typecheck/tests, and perform authenticated browser visual QA at the reference desktop size plus tablet/mobile fallbacks.

## Current risks and deliberate deferrals

- The repository is Internal QA ready, not staging validated or GA.
- The supplied screenshots contain illustrative data and cannot be used as seed or fallback production truth.
- Combined overview KPIs are deferred until backed by bounded module-owned summaries; unavailable states are the correct interim UI.
- Authenticated browser fidelity evidence requires a running API, seeded tenant, and credentials. Public-only Playwright results do not satisfy that gate.
- No backend, Prisma, permission, or OpenAPI change is justified by the shared-foundation audit alone.
- M3 visual parity must not cause a second finance domain, browser-owned money calculations, unaudited financial actions, raw private-file links, or premature gateway enablement.

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
| M3 | `/dashboard/finance` | Defaulter count and outstanding value use the backend report; collected-today, total-due, close-status, reversal, and receipt totals remain unavailable where no overview contract exists. The reference-screen slice above defines the required cashier-first and contract-safe refinement, but does not claim its implementation. |
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

For M3, also exercise `/dashboard/finance/collections`, `/dashboard/finance/invoices`, `/dashboard/finance/receipts`, `/dashboard/finance/reversals-refunds`, `/dashboard/finance/cashier-close`, and `/dashboard/finance/reports` with permission-varied seeded accounts. Validate the selected-record rail or detail route at the reference desktop viewport, then validate the compact/drawer behavior at tablet and narrow widths.

## Follow-up plan

### P1 — required before this slice can be called visually complete

1. Run authenticated browser QA against a seeded local or staging tenant when the browser policy permits the target URL.
2. Compare all ten overview routes against their supplied references at the reference viewport, then correct verified spacing, overflow, focus, keyboard, and responsive defects.
3. Implement the M3 screen groups in the documented order while preserving canonical routes and real contracts: overview, collection counter, invoices/invoice detail, receipts, defaulters/reminders, adjustments/approvals, reversals/refunds, cashier close, and reports.
4. Add bounded, module-owned overview APIs only for recurring operational decisions that cannot be represented honestly with existing responses; update OpenAPI, shared contracts, permissions, query tests, and tenant-scoped index review together.
5. Add focused authenticated browser coverage for M3 payment idempotency, protected receipt/document actions, permission denial, module lock, cashier-close overlap, and unavailable-gateway states.
6. Add focused authenticated browser coverage for the two new composition routes and their permission/module-lock states.

### P2 — refinement after P1 evidence

1. Move growing-list filter state to URL search parameters where the current canonical workspace still keeps it locally.
2. Add persisted backend job-state presentation for report-card, accounting-export, M3 reports, and other long-running work only after those job contracts are confirmed.
3. Consolidate remaining duplicated dashboard primitives into the shared system without rewriting stable module workflows.
4. Capture staging provider, protected-download, device-width, observability, rollback, and controlled-pilot evidence under the GA release policy; local source checks do not satisfy those gates.