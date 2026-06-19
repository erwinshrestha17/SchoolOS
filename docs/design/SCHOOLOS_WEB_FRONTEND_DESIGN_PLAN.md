# SchoolOS Web Frontend Design Plan

**Status:** Active source of truth for SchoolOS web frontend design, UI/UX, route behavior, API usage, and web persona smoke expectations.  
**Updated:** 2026-06-19  
**Scope:** `apps/web`, Next.js App Router, school dashboard, platform control plane, settings, reports, protected files, and dense school operation workspaces.

This document is planning and design guidance only. It does not implement backend, frontend, mobile, database, migration, package, or test code.

---

## 1. Active Module Numbering

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

`M8A`, `M8B`, and `M8C` are obsolete labels. Library, Transport, and Canteen are standalone modules.

Inventory & Asset Management is not active web scope.

---

## 2. Product Principle

SchoolOS web is the daily command center for Nepal schools. It should help school staff run real school work quickly, safely, and confidently.

It must feel like:

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

Every web screen must answer quickly:

```text
1. Where am I?
2. What needs my attention?
3. What can I safely do here?
```

A good SchoolOS screen has:

- A clear page title.
- A short school-friendly purpose line.
- One primary action.
- Secondary actions under `More Actions`.
- Real backend data or an honest unavailable/empty state.
- Permission-safe visibility.
- Clear next action.
- No fake numbers.
- No hidden financial, staff, student, file, or communication risk.

---

## 3. Web Surface Boundaries

| Plane | Route family | User | Purpose |
|---|---|---|---|
| School Operations | `/dashboard/*` | School staff | Daily school workflows. |
| Tenant Configuration | `/dashboard/settings/*` | School admin / authorized roles | One school's configuration. |
| Platform Control Plane | `/platform/*` | SchoolOS operator / platform admin | SaaS tenant, provider, queue, support, and platform operations. |

Rules:

- School Operations must never expose platform-only controls.
- School Settings must not become SaaS billing/platform configuration.
- Platform must not expose tenant-private data unless explicit audited support override is active.
- School fee collection is not SchoolOS SaaS billing.
- M11 Accounting is a school accounting module, not a platform billing microservice.

---

## 4. Non-Negotiable Web Guardrails

### 4.1 Security and tenant isolation

- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- Frontend hiding is only UX; it is never security.
- Every API call must rely on authenticated session context and backend authorization.
- Do not expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session routes must use purpose-limited data, not admin-shaped payloads.

### 4.2 Data truth

- Real APIs only.
- No fake frontend data.
- No placeholder production metrics.
- No browser-only production state.
- No client-side money truth.
- No client-calculated official attendance, fees, payroll, accounting, library, transport, canteen, notification, or learning totals.
- Growing lists must be paginated and filtered server-side.
- Dashboard summaries may show unavailable states if a summary API is missing.

### 4.3 Protected files

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
Chat attachments
Homework attachments
Learning resources
Accounting reports
Exports and snapshots
Generated documents
```

Rules:

- Use File Registry-backed authenticated helpers.
- Use `ProtectedFileButton`, `ProtectedFileLink`, or shared blob/download helpers.
- Do not use raw `window.open` for private files.
- Do not persist raw signed URLs in client state beyond the immediate action.
- Do not expose object keys, provider bucket URLs, or permanent signed URLs.

---

## 5. Standard Layout Pattern

Every operations workspace should follow this rhythm:

```text
ModuleHeader
KPI strip / Summary strip where useful
Quick actions or tabs
Filter bar
Main table / form / workflow area
Right detail drawer or full detail route
Audit / export / protected file actions
Footer timestamp / last updated where API provides it
```

Header rules:

- One primary action per route.
- Put secondary actions such as import, export, print, and settings under `More Actions` where possible.
- Destructive actions are never primary decorative CTAs.
- High-risk actions require confirmation and reason where policy requires it.

---

## 6. Required Web States

Every screen must explicitly handle:

```text
Loading
Empty
No search results
Error with retry
Permission denied
Module locked
Validation failure
Mutation pending
Mutation success
Mutation error
Partial success
Queued / processing job
File unavailable
Provider disabled / mock / failed where relevant
Session expired
Slow network
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

Use school-friendly copy, for example:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
This report is being prepared. You can download it when it is ready.
```

---

## 7. Module Workspace Expectations

### M1 Admissions and Student Profiles

- Inquiry/admission workflow, duplicate review, student profile, guardians, documents, QR/ID, transfer/withdrawal/graduation/alumni states, and IEMIS readiness.
- Teacher limited scope must not see unrelated students.
- Student files use protected helpers.

### M2 Smart Attendance

- Teacher assigned-class marking.
- Correction requests with reason.
- Lock windows and non-working-day states.
- Parent alerts through M12.
- Monthly register exports through protected helper.

### M3 Fees and Receipts

- Backend-owned fee, invoice, receipt, payment, reversal, refund, waiver, and cashier-close totals.
- Payment submission must be idempotent.
- Receipt appears only after confirmed backend success.
- Reversal/refund requires reason, permission, and audit.

### M4 Academics, Exams, CAS, Report Cards

- Subject teacher assignment scope.
- Grade sheets, CAS, exam terms, report-card generation/publish states.
- Report-card files use protected helpers.
- Parent/student see published child/self-scoped results only.

### M5 Activity Feed and Milestones

- Consent-aware activity posts and media.
- Parent sees linked-child and consent-safe media only.
- Removed guardians lose access.
- Moderation actions are audited.

### M6 Homework and Timetable

- Homework publish/lock/archive states.
- Timetable conflict panel.
- Attachments through File Registry.
- Parent/student see assigned published work only.

### M7 HR and Payroll

- Admin HR/payroll routes separate from staff self-service.
- Staff documents, contracts, salary, bank, PAN, payslip fields are permission-gated and masked by default.
- Payroll totals are backend-owned.
- Posted payroll uses reversal/correction workflow only.

### M8 Library

- Catalogue and copy management remain separate.
- Issue/return/renew is scanner-first.
- Borrower eligibility and policy state show before confirmation.
- Parent library view is child-scoped.
- Fine calculations and copy totals come from backend.

### M9 Transport

- Parent status is child-route scoped and timestamped/stale-labelled.
- Driver/conductor screens are assigned-trip scoped.
- Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed.
- Vehicle/route/trip documents use protected file helpers.

### M10 Canteen

- POS/wallet/meal serving values are backend-owned truth.
- Allergy/medical warning visible before serving.
- Duplicate serve and receipt reprint states are idempotency-aware.
- Parent spending APIs are child-scoped.

### M11 Accounting and Finance

- No client-owned accounting truth.
- Posted records use reversal/correction flow.
- Period close/reopen is high risk and requires reason.
- Large exports use File Registry and job status.
- Bank reconciliation suggestions must not auto-post.

### M12 Notifications, Notices, Communication, Chat

- Source modules emit events; M12 owns delivery lifecycle.
- Notification center and unread counts are user-scoped.
- Notice targeting/preview is backend-owned.
- Provider-disabled, mock, failed, partial, and queued states are explicit.
- Parent-teacher chat remains assignment/permission scoped.
- Attachments use File Registry.
- Escalation/report actions are audited.

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

## 8. Main Dashboard Rules

The dashboard is the school command center. It is not a place to show every module in depth.

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

## 9. Web Persona Smoke Expectations

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
Driver cannot view another trip.
Platform operator cannot view tenant-private data without support override.
Module-locked route shows ModuleLockedState and backend blocks action.
```

---

## 10. Screen Completion Checklist

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

## 11. Verification Commands

Run relevant gates only and report honestly:

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

Docs-only changes need no runtime checks.
