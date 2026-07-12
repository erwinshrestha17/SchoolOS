# SchoolOS Web Design System

**Status:** Active design-system guidance for `apps/web`.

**Source:** Derived from the SchoolOS Web Frontend Design Plan.

**Purpose:** Give Next.js implementers and Codex a stable web UI/UX standard for SchoolOS dashboard, settings, platform, reports, protected files, and dense school operation workspaces.

---

## 1. Web Design North Star

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

Core design principle:

```text
One screen = one main job.
```

Every web screen must answer these three questions within 10 seconds:

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
- No hidden financial or student-data risk.

---

## 2. Web Surface Boundaries

SchoolOS web has three major planes.

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

## 3. Non-Negotiable Web Guardrails

### 3.1 Security and tenant isolation

- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- Frontend hiding is only UX; it is never security.
- Every API call must rely on authenticated session context and backend authorization.
- Do not expose internal IDs unless the existing API contract already safely exposes them for UI routing.
- Never expose raw Prisma errors, stack traces, secrets, provider credentials, object keys, or permanent public storage URLs.
- Parent, driver, staff self-service, and student lab/session web routes must use purpose-limited data, not admin-shaped payloads.

### 3.2 Data truth

- Real APIs only.
- No fake frontend data.
- No placeholder production metrics.
- No browser-only production state.
- No client-side money truth.
- No client-calculated official attendance/fees/payroll/accounting totals.
- Growing lists must be paginated and filtered server-side.
- Dashboard summaries may show unavailable states if a summary API is missing.

### 3.3 Protected files

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
- File unavailable, permission denied, expired, or missing states must be friendly and safe.

### 3.4 Architecture boundaries

- Keep Next.js in `apps/web`.
- No Angular migration.
- No microservices.
- No AI runtime or M11 UI until explicitly approved.
- Keep SchoolOS as a modular monolith from the frontend user's point of view.
- Cross-module UI aggregation must call defined APIs, not invent backend shortcuts.

---

## 4. UX Language

SchoolOS is used by real school staff, not just technical users.

Use school-friendly copy:

```text
Save failed. Please check the highlighted fields.
You do not have permission to reverse payments. Please contact the school administrator.
This module is not enabled for this school.
Receipt download is unavailable right now.
Attendance is locked for this date.
This report is being prepared. You can download it when it is ready.
```

Avoid exposing technical copy:

```text
403 Forbidden
Mutation failed
Unhandled exception
PrismaClientKnownRequestError
Entity not found
Invalid payload
Object key missing
```

Prefer school terms:

| Prefer | Avoid |
|---|---|
| Student | Entity |
| Guardian | Relation object |
| Receipt | Payment artifact |
| Class / Section | Group / Subgroup |
| Staff | Employee entity |
| School Settings | Tenant config |
| Platform | Super admin module |
| Not enabled | Unauthorized module |

---

## 5. Visual Direction

### 5.1 Look and feel

- Calm light app background.
- White cards, tables, panels, and drawers.
- Soft blue-grey page background.
- Deep blue/indigo primary identity.
- Rounded cards and panels, generally 16-24px radius.
- Subtle borders and shadows only where hierarchy requires it.
- Clear typographic hierarchy.
- Charts only when they help decisions.
- No decorative gradients as the main UI language.
- No crowded dashboard cards.

### 5.2 Base tokens

| Token | Value | Usage |
|---|---:|---|
| `brand.primary` | `#155EEF` | Primary actions, active links. |
| `brand.primaryDark` | `#0B3A88` | Sidebar active state, strong headers. |
| `brand.primarySoft` | `#EAF1FF` | Soft active/selected backgrounds. |
| `brand.secondary` | `#7C3AED` | Secondary accent. |
| `surface.app` | `#F3F7FB` | Main background. |
| `surface.card` | `#FFFFFF` | Cards, panels, tables. |
| `surface.subtle` | `#F8FAFC` | Subtle table headers / grouped blocks. |
| `border.default` | `#E2E8F0` | Card/table borders. |
| `text.primary` | `#0F172A` | Primary text. |
| `text.secondary` | `#475569` | Secondary text. |
| `text.muted` | `#64748B` | Helper labels. |
| `success` | `#16A34A` | Success state. |
| `warning` | `#D97706` | Warning state. |
| `danger` | `#DC2626` | Error/destructive state. |
| `info` | `#0284C7` | Informational state. |

### 5.3 Module accents

Module accents identify location. They must not replace semantic status colors.

| Area | Accent |
|---|---:|
| Dashboard | `#155EEF` |
| Platform Control | `#4F46E5` |
| Admissions / Students | `#2563EB` |
| Attendance | `#059669` |
| Fees / Receipts | `#D97706` |
| Academics | `#7C3AED` |
| Activity Feed | `#DB2777` |
| Homework / Timetable | `#0284C7` |
| HR / Payroll | `#9333EA` |
| Library | `#0D9488` |
| Transport | `#EA580C` |
| Canteen | `#65A30D` |
| Accounting | `#0F766E` |
| Notices / Chat | `#E11D48` |
| Learning | `#7C3AED` |
| Reports | `#0891B2` |
| Settings | `#475569` |

---

## 6. Global Layout System

The standard authenticated school web layout is:

```text
Topbar
Left Sidebar
Page Header
Context Bar / Filters
Summary / KPI Strip
Main Work Area
Optional Right Panel / Drawer
Sticky Action Bar only for multi-step or review flows
```

### 6.1 Topbar

Topbar contains global context only:

- SchoolOS identity.
- School switcher where the user has access to multiple schools.
- Academic year switcher where academic-year context matters.
- Global search.
- Notification center.
- Support override banner if active.
- User menu.

Topbar must not contain module-specific primary actions except global search and notifications.

### 6.2 Sidebar

Recommended navigation groups:

```text
Home

Students
  Admissions
  Guardians

Daily Operations
  Attendance
  Fees
  Communications
  Activity Feed

Academics
  Exams & Report Cards
  Homework & Timetable
  Learning

School Operations
  Library
  Transport
  Canteen

Staff & Finance
  HR & Payroll
  Accounting

Reports

System
  Settings
```

Rules:

- Sidebar is navigation only.
- No KPIs in the sidebar.
- No action buttons in the sidebar except safe navigation.
- No finance amounts in the sidebar.
- No student private data in the sidebar.
- Locked modules may show a subtle lock indicator.
- Direct locked route access still shows a full `ModuleLockedState`.
- Do not show implementation-phase names in navigation.

---

## 7. M12 Notices / Communication / Chat Design Rules

The PRD owns communication outcomes, the SRS owns web requirements, and the Module Design Catalog owns M12 boundaries. The canonical frontend guardrails in this design system still apply.

### 7.1 M12 workspace patterns

M12 uses four primary layout patterns:

| Pattern | Used for |
|---|---|
| Dashboard grid | Communication overview, KPI strip, notice activity, unread queue, provider health, recent events. |
| Form plus preview rail | Notice composer, targeting, channel preview, recipient summary. |
| Table plus right detail panel | Approvals, delivery logs, callback monitor, moderation cases. |
| Three-column conversation workspace | Communication inbox and parent-teacher chat. |
| Library plus preview rail | Templates and scheduling. |

Do not force a single generic table layout across all M12 screens. The selected pattern must match the primary job.

### 7.2 M12 lifecycle states

M12 UI copy must distinguish these states where backend contracts support them:

```text
Draft
Approval pending
Approved
Scheduled
Queued
Dispatching
Sent to provider
Delivered
Opened / Read
Partially delivered
Delayed
Failed
Retried
Cancelled
Archived
```

Never label a queued or provider-accepted message as delivered.

### 7.3 Required M12 status chips

| Status family | Chip guidance |
|---|---|
| Delivered / approved / provider healthy | Green success chip. |
| Pending / delayed / awaiting approval / backlog warning | Orange warning chip. |
| Failed / blocked / high-risk / signature failed | Red danger chip. |
| Sent / in-app / selected / informational | Blue info chip. |
| Duplicate / archived / ignored / unavailable | Neutral gray chip. |
| Mock/dev provider | Blue or purple chip with explicit `Mock / Dev` text. |

Color is not sufficient by itself. Every chip must contain readable text.

### 7.4 Notice composer standards

The notice composer must include:

- Notice details.
- Delivery channel cards.
- Target audience controls.
- Schedule/template controls.
- Per-channel live preview.
- Recipient preview.
- Recipient summary.
- Protected attachment rows.
- Send/schedule/request-approval confirmation.

Before final send or schedule, show the recipient and channel impact summary. Recipient counts, channel eligibility, and estimated SMS cost must come from backend data or be clearly unavailable.

### 7.5 Approval and audit standards

High-impact notice approval screens must show:

- Why approval is required.
- Requested by / requested on / scheduled for.
- Requested recipients.
- Notice content.
- Delivery channels.
- Protected attachments.
- Approval policy.
- Risk assessment.
- Approval history.
- Audit trail.
- Comment and approve/reject/return actions.

If the notice changes after return-for-changes, show backend-provided diff details where available. Do not invent diff facts in the browser.

### 7.6 Delivery and provider standards

Delivery log and provider-monitor screens must be precise and safe:

- Provider-disabled channels must be visibly blocked.
- Retry actions must be permission-gated and audited.
- Raw provider events must be permission-gated.
- Provider secrets, signing keys, tokens, and raw credentials must never be rendered.
- Duplicate and out-of-order callbacks should be visible as audit events, not treated as normal delivery proof.
- Export actions must use protected file/download helpers where they produce files.

### 7.7 Chat and moderation standards

Parent-teacher chat and moderation screens must preserve school-safety context:

- Teacher chat scope is assignment-limited unless permission grants broader scope.
- Student context must be visible for parent conversations where permitted.
- Quiet-hours state must be visible and backend-enforced.
- Messages and attachments must use protected access patterns.
- Report, escalate, block, resolve, reopen, and audit-note actions must be explicit, permission-gated, and audited.
- Safety copy should warn users not to share passwords, OTPs, payment details, or other sensitive personal data in chat.

### 7.8 M12 responsive behavior

Desktop references are dense operating-desk layouts. For narrower viewports:

- Collapse right detail rails into drawers.
- Keep the primary workflow visible first.
- Move long filter rows into expandable filters.
- Use table column priority instead of unreadably compressed tables.
- Keep chat composer reachable without hiding student safety context entirely.
- Preserve clear selected-row, selected-conversation, and selected-case states.
