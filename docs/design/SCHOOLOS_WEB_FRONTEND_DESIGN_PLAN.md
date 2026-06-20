# SchoolOS Web Frontend Design Plan

**Status:** Active global source of truth for SchoolOS web design rules.
**Updated:** 2026-06-20
**Scope:** `apps/web`, Next.js App Router, school operations, school settings, platform control plane, shared states, protected files, and contract-safe frontend behavior.

This document contains global web rules only. Feature lists, module workflows, expected screens, wireframes, role projections, and module backend needs live in [`docs/design/modules/`](modules/README.md). Backend/web/mobile allocation and explicit surface boundaries live in [`SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`](../product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md). This is design guidance, not evidence that a route or API exists.

---

## 1. Product and Release Stance

SchoolOS web is the daily operating desk for Nepal schools. It is not a decorative dashboard, generic ERP skin, shortcut wall, or fake demo.

It is the primary surface for official setup, detailed records, high-volume work, approvals, reconciliation, publishing, reporting, audits, and operational control. Mobile companions may accelerate bounded daily actions, but they do not replace the web operating workspace or broaden a persona's authority.

The governing interaction rule is:

```text
One screen = one main job.
```

A user should quickly understand:

```text
Where am I?
What needs attention?
What can I safely do next?
```

Every screen must use real backend data or an honest unavailable state. Local UI completeness does not establish staging, pilot, release-candidate, or GA readiness; release claims follow `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`.

---

## 2. Active Module Taxonomy

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
| M14 | Intelligence / AI — deferred roadmap only |

Legacy compound M8 labels are not active module identifiers. Library, Transport, and Canteen are independent modules. Inventory & Asset Management is outside active scope. Do not create M14 runtime, prediction, tutor, generation, or automated-decision UI unless the owner explicitly approves it.

---

## 3. Web Theme

SchoolOS uses a calm, light, operations-first visual language:

- Soft blue-grey application background.
- White cards, tables, panels, forms, and drawers.
- Deep blue/indigo primary identity.
- Module accent colors for location only.
- Semantic success, warning, danger, and information colors for status.
- Subtle borders and shadows where hierarchy needs them.
- Rounded panels consistent with the shared design system.
- Charts only when they make a decision materially easier.
- No decorative gradients or crowded KPI walls.

The token values and shared visual primitives are defined in [`apps/web/docs/DESIGN_SYSTEM.md`](../../apps/web/docs/DESIGN_SYSTEM.md).

---

## 4. App Shell and Surface Boundaries

| Plane | Route family | Primary user | Purpose |
|---|---|---|---|
| School Operations | `/dashboard/*` | School staff | Daily school workflows |
| Tenant Configuration | `/dashboard/settings/*` | Authorized school admin | One school's configuration |
| Platform Control Plane | `/platform/*` | SchoolOS platform operator | SaaS tenant/provider/queue/support operations |

The authenticated shell uses:

```text
Global topbar
Role- and entitlement-aware sidebar
Page header
Optional context/filter bar
Summary strip when useful
Primary work area
Optional detail drawer
```

Rules:

- The topbar contains global school/year context, search, notifications, support-override banner where applicable, and the user menu.
- The sidebar is navigation, not a KPI or action surface.
- School operations never expose platform-only controls.
- School settings never become SaaS billing or platform configuration.
- Platform views do not expose tenant-private records without an explicit audited support override.
- School fee collection and M11 school accounting remain separate from SchoolOS subscription billing.

---

## 5. Navigation Rules

- Group navigation by school work: Home; Students; Daily Operations; Academics; School Operations; Staff and Finance; Reports; System.
- Derive visible destinations from authenticated role, tenant status, and module entitlement.
- Frontend hiding improves usability only. Direct route/API access still requires backend authorization.
- Show a subtle locked indicator only where useful; direct locked-route access renders the full module-locked state.
- Preserve meaningful academic year, fiscal period, class/section, date, and filter context during drill-down.
- Deep links reauthorize current tenant, role, entitlement, recipient, assignment, and record scope.
- Do not expose implementation sprint names, obsolete module labels, internal IDs, or provider concepts in school-user navigation.

---

## 6. Standard Layout Rules

The default operations workspace is:

```text
ModuleHeader
KpiGrid / SummaryStrip (only when backed by a summary contract)
Tabs or subnavigation (only for stable subdomains)
FilterBar
Main table / grid / form / workflow
Detail drawer or full detail route
Audit / export / protected-file actions
Last-updated or snapshot time when supplied by backend
```

Header rules:

- One primary action.
- A short school-language purpose line.
- Secondary import, export, print, settings, and uncommon actions under `More Actions`.
- Destructive actions are separated from routine actions.
- High-risk actions show impact, require confirmation, collect a reason where policy requires it, and expose pending/success/failure state.

Drawer rules:

- Use a drawer for row/card detail that benefits from preserving filters and selection.
- Use a full route for long forms, multi-stage review, complex history, or a shareable/bookmarkable record.
- At smaller desktop/tablet widths, convert persistent rails into drawers.

---

## 7. Shared Components and Reuse Rules

Prefer existing shared primitives before creating module-specific variants:

| Shared primitive | Global use |
|---|---|
| `ModuleHeader` | Title, purpose, primary action, secondary menu |
| `KpiGrid` / `SummaryStrip` | Backend-owned summaries |
| `FilterBar` | Server-side query controls and active filters |
| Paginated table | Growing operational lists |
| Status badge | Text plus semantic color |
| Detail drawer | Selected detail, actions, audit |
| Validated form sections | Create/edit/review workflows |
| Confirmation/reason dialog | High-risk mutations |
| `ProtectedFileButton` / `ProtectedFileLink` | Authenticated file access |
| Upload widget | File Registry-backed upload and processing state |
| Timeline/audit panel | Backend actor, time, reason, and state history |
| Shared state components | Loading, empty, error, permission, locked, unavailable |

A module may compose these primitives into purpose-built widgets. It must not fork the theme, error language, file behavior, or authorization model.

---

## 8. Typography, Spacing, and Density

- Use the design-system type scale; page title, section heading, body, label, helper, and table text have stable hierarchy.
- Keep body text readable and labels explicit. Do not replace labels with placeholder-only inputs.
- Use consistent spacing increments from the design system; avoid arbitrary one-off gaps.
- Dense tables are appropriate for school operations, but essential columns, row actions, and status must remain readable on common laptops.
- Prioritize columns on narrower widths. Do not squeeze every desktop column into an unreadable table.
- Long filters collapse into an expandable filter panel.
- Sticky action bars are reserved for long forms and review flows.
- Color is never the only carrier of state.
- Keyboard focus, form errors, table controls, dialog focus, and protected-file actions must remain accessible.

---

## 9. State Handling Rules

Every route explicitly handles:

| State | Required behavior |
|---|---|
| Loading | Layout-matching skeleton; preserve title and context |
| Empty | Explain why and offer one permitted next action |
| No results | Preserve filters and provide clear-filter action |
| Error | Parse bounded backend error, retain safe context, offer retry |
| Permission denied | Reveal no forbidden data or identifiers |
| Module locked | Show entitlement state; no fake fallback values |
| Validation failure | Inline field errors and summary for long forms |
| Mutation pending | Prevent duplicate submission |
| Success | Confirm outcome and refetch/invalidate affected data |
| Mutation failure | School-friendly message; preserve safe input |
| Partial success | Itemize successful and failed records |
| Queued/processing | Show backend job lifecycle and refresh |
| File unavailable | Explain missing, expired, restricted, or generation failure safely |
| Provider disabled/mock/degraded | State the mode precisely where relevant |
| Session expired | Return safely to authentication without leaking cached data |
| Slow/stale data | Preserve current data, show timestamp/stale label, offer refresh |

Never render raw HTTP codes, stack traces, Prisma messages, provider payloads, object keys, or internal exception text.

---

## 10. Protected File Rules

Protected files include student documents/photos, receipts, cashier-close reports, report cards, activity media, homework/learning resources, staff documents/contracts/payslips, vehicle documents, notice/chat attachments, accounting evidence/reports, labels, exports, and generated certificates.

Required flow:

```text
Feature UI
-> authenticated File Registry helper
-> backend authorization
-> short-lived protected access or authenticated download
```

Rules:

- Use shared protected-file buttons, links, blob helpers, and upload components.
- Never use a raw private URL or raw `window.open`.
- Never expose object keys, bucket/provider URLs, or storage internals.
- Do not persist signed URLs beyond the immediate action.
- Reauthorize tenant, role, record scope, and current relationship/assignment on every open/download.
- Render unavailable, missing, processing, failed, expired, and permission states explicitly.
- Generated files show backend job state, version/snapshot time, and protected download only after confirmation.

---

## 11. Backend and API Usage Rules

- Backend/OpenAPI/shared contracts are authoritative for route names, DTOs, totals, transitions, locks, permissions, files, jobs, audit, and error envelopes.
- Inspect current routes, API clients, OpenAPI, shared types, permissions, and tests before implementation.
- Do not invent endpoint names or response shapes.
- Mark unresolved design dependencies `needs OpenAPI confirmation` or `needs backend verification`.
- Use authenticated cookie/session-aware shared API clients.
- Growing lists filter and paginate server-side.
- Official money, attendance, payroll, accounting, library, transport, canteen, notification, and learning values come from backend responses.
- Dashboard/module summaries use module-owned summary APIs. Do not derive official totals by fetching or summing list pages.
- Mutations recheck authorization and current state, handle idempotency where required, and invalidate/refetch the relevant backend truth.
- Large exports and generation work use backend jobs with queued/processing/succeeded/failed UI.
- Missing safe APIs produce an honest unavailable/locked/permission state, never fake production behavior.

---

## 12. Role and Scope Rules

Backend enforcement is mandatory for every surface:

- Admin/principal access follows explicit permissions and never implies universal sensitive-data access.
- Teacher access is limited to assigned class, section, subject, or student context unless a broader permission is verified.
- Parent access is limited to currently linked children; unlinking removes data and file access immediately.
- Student access is self/session scoped.
- Staff self-service is own-data only and uses purpose-limited payloads.
- Driver/conductor access is assigned-trip only.
- Cashier, accountant, librarian, transport, canteen, HR/payroll, and communication roles receive the minimum data/actions required for their job.
- Platform operator access stays on `/platform/*`; tenant-private detail requires audited support override.
- Disabled modules and suspended tenants fail closed.
- Sensitive salary, bank, tax, medical, identity, communication, finance, and provider fields are omitted or masked by backend permission.

---

## 13. Responsive and Interaction Rules

- Desktop/laptop is the primary dense-operations target; tablet widths remain usable.
- Collapse right rails into drawers.
- Prioritize table columns and keep row actions reachable.
- Convert multi-column forms to one column while preserving section order.
- Keep the primary action visible; do not create competing sticky CTAs.
- Preserve selected record/conversation/case state.
- Use horizontal scrolling only for genuinely wide data such as marks or accounting lines, with identity columns kept understandable.
- Do not imply offline mutation support. If an approved read-only cached state exists, label its age and disable unsafe writes.

---

## 14. Main Dashboard Rules

The main dashboard composes safe module summaries; it does not duplicate module business logic.

Recommended rhythm:

```text
School status header
Backend-owned school summary
Today's operations
Pending approvals and alerts
Module summary grid
Recent activity
Role-based quick actions
```

Rules:

- Request purpose-built, permission-filtered summaries.
- Never deep-fetch every module or calculate official totals in the browser.
- Locked/unavailable summaries remain honest.
- Do not expose private messages, salary/bank details, journal lines, raw student-sensitive data, or protected-file metadata.
- Click-through reauthorizes and preserves safe filters.
- One unavailable module summary must not block the rest of the dashboard.

---

## 15. Module Design References

All feature explanations, personas, routes, screen specifications, wireframes, component plans, backend dependencies, state matrices, security rules, Nepal requirements, and done definitions live in these files:

| Module | Frontend web design reference |
|---|---|
| M1 Admissions and Student Profiles | [M1 reference](modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md) |
| M2 Smart Attendance | [M2 reference](modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md) |
| M3 Fees and Receipts | [M3 reference](modules/M3_FEES_RECEIPTS_FRONTEND_REFERENCE.md) |
| M4 Academics, Exams, CAS, Report Cards | [M4 reference](modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md) |
| M5 Activity Feed and Milestones | [M5 reference](modules/M5_ACTIVITY_FEED_MILESTONES_FRONTEND_REFERENCE.md) |
| M6 Homework and Timetable | [M6 reference](modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md) |
| M7 HR and Payroll | [M7 reference](modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md) |
| M8 Library | [M8 reference](modules/M8_LIBRARY_FRONTEND_REFERENCE.md) |
| M9 Transport | [M9 reference](modules/M9_TRANSPORT_FRONTEND_REFERENCE.md) |
| M10 Canteen | [M10 reference](modules/M10_CANTEEN_FRONTEND_REFERENCE.md) |
| M11 Accounting and Finance | [M11 reference](modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md) |
| M12 Notifications, Notices, Communication, Chat | [M12 reference](modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md) |
| M13 Learning Layer | [M13 reference](modules/M13_LEARNING_LAYER_FRONTEND_REFERENCE.md) |

M14 remains deferred and intentionally has no active implementation reference.

---

## 16. Common Implementation Checklist

```text
[ ] One clear title, purpose, main job, and primary action.
[ ] Uses the app shell and shared design-system primitives.
[ ] Current route, OpenAPI, shared contracts, permissions, DTOs, and tests inspected.
[ ] Real APIs and backend-owned totals only.
[ ] No fake/mock/placeholder production data.
[ ] Tenant/RBAC/entitlement and persona scope fail closed.
[ ] Loading, empty, no-results, error, permission, locked, validation, mutation,
    partial, queued, stale, and file states implemented.
[ ] Growing lists filter and paginate server-side.
[ ] High-risk mutation confirms impact, collects reason where required,
    prevents duplicate submission, and shows audit state.
[ ] Protected files use File Registry-backed authenticated helpers.
[ ] No raw backend/provider/storage errors, object keys, or private URLs.
[ ] Responsive and accessibility basics verified.
[ ] Module-specific reference followed.
```

---

## 17. Documentation and Verification Rule

Module-specific details belong only in `docs/design/modules/`; keep this file global. When module behavior changes, update the smallest matching module reference rather than adding another split plan.

Docs-only edits require no application build. Run documentation/status/text checks relevant to the change and report only commands that actually ran.
