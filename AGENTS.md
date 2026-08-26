# SchoolOS Agent Instructions

Repository-wide rules for human and AI contributors. Keep work production-oriented, Nepal-only, scoped, evidence-based, secure, offline-first, fiscally correct, and consistent across web/mobile/platform.

**Current posture:** P0 production-safety execution for a controlled real-school pilot.

**Repository-wide invariants:** tenant isolation, fail-closed authorization, offline-first operation, School Edge continuity, immutable authoritative financial history, Nepal IRD/fiscal policy versioning, evidence-based release claims, and persona-specific operational UI.

**Active P0 modules:** M0–M7, M11, M12, M15 as required by current P0 workflows.

**Deferred/frozen:** M8 Library, M9 Transport, M10 Canteen, M13 Learning, M14 Intelligence/AI. Preserve existing data, migrations, contracts, permissions, tests, and compatibility code; add no new feature work unless the project owner explicitly reactivates a module.

## 1. Instruction precedence

1. Explicit project-owner instruction for the current task.
2. This root `AGENTS.md`.
3. Scoped `AGENTS.md` in the touched app/package.
4. Canonical product, requirements, architecture, security, compliance, design, and release documents.
5. Existing contracts, migrations, tests, and code conventions.

Latest explicit owner decisions override stale roadmap assumptions. When a confirmed conflict exists, update the canonical source instead of silently preserving contradictory behavior.

## 2. Canonical sources

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, then read only focused sources required for the task.

| Area | Canonical source |
|---|---|
| Product/function | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| API/database/web/mobile requirements | `docs/requirements/SCHOOLOS_SRS.md` |
| Architecture/security/platform | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| Module ownership/gaps | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Web | `apps/web/AGENTS.md`, `apps/web/e2e/README.md` |
| Mobile | `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` |
| Production/operations | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not create duplicate PRDs/SRSs/SDDs/runbooks/design systems when content belongs in a canonical document. Track active work/blockers in GitHub Issues, Milestones, or Projects where available.

## 3. Module taxonomy and active scope

| Module | Name | Status |
|---|---|---|
| M0 | Platform Core | Active P0 |
| M1 | Admissions and Student Profiles | Active P0 |
| M2 | Smart Attendance | Active P0 |
| M3 | Fees and Receipts | Active P0 |
| M4 | Academics, Exams, CAS, Report Cards | Active P0 |
| M5 | Activity Feed and Milestones | P0-dependent only |
| M6 | Homework and Timetable | P0-dependent only |
| M7 | HR and Payroll | P0-dependent only |
| M8 | Library | Deferred |
| M9 | Transport | Deferred |
| M10 | Canteen | Deferred |
| M11 | Accounting and Finance | Active P0 |
| M12 | Notifications and Delivery | Active P0 |
| M13 | Learning Layer | Frozen / disabled by default |
| M14 | Intelligence / AI | Roadmap-only |
| M15 | Notices and Announcements | Active P0 |

- `M8A`, `M8B`, `M8C` are obsolete.
- Inventory/Asset Management is not active scope.
- Chat/conversations are removed from active product scope.
- A broad standalone Student App is not active scope.
- Parent remains app-only under current scope.

## 4. Nepal-only boundary and P0 order

SchoolOS is a Nepal-first multi-tenant school operating SaaS for:

- `SCHOOL`: Grades 1–10.
- `HIGHER_SECONDARY`: Grades 11–12 / +2.

Do not introduce international expansion, Cambridge/IB/British/American curriculum execution, OneRoster/LTI, foreign accreditation/compliance, cross-country localization, preschool, Bachelor’s/Master’s institution management, public rankings, or social/open-chat features without a new explicit owner decision.

Release claims require evidence:

```text
Development complete
→ Internal QA ready
→ Staging validated
→ Controlled pilot validated
→ Release candidate
→ GA / Production release
```

Local tests/builds/demos are not staging, pilot, RC, or GA evidence.

P0 is the default implementation scope. Do not start P1/P2 feature expansion while unresolved P0 blockers remain unless explicitly instructed.

Product P0 safety themes (keep these invariants; do not treat them as a permission to add modules):

1. P0-01 — fail-closed entitlements, tenant isolation, teacher assignment authorization, guardian scoping, cache invalidation, authorization matrix.
2. P0-02 — attendance correctness, locking, idempotency, correction history.
3. P0-03 — marks authorization, review/lock/publish/unlock/correction/versioning.
4. P0-04 — versioned Nepal School Education Compliance Profile.
5. P0-05 — reproducible IEMIS validation/export; no direct-sync claim without an authorized interface.
6. P0-06 — fee/receipt/immutable-ledger/IRD fiscal integrity, versioned tax policy, CBMS applicability where required, reconciliation, and idempotent M3/M7→M11 posting.
7. P0-07 — privacy, safeguarding, consent, protected files, sensitive-access audit.
8. P0-08 — offline-first web/mobile operation, School Edge continuity, synchronization, conflict recovery, and no-internet resilience.
9. Nepal localization correctness: Nepali Unicode, NPR, Nepal timezone, Nepal address hierarchy, BS/AD presentation with canonical date storage.
10. Backup/restore, clean migrations, observability, provider/storage readiness, and controlled-pilot evidence.

### Backend production-hardening (owner, 2026-08-25)

The main backend work concentrates on production-hardening the existing core operational path. Do not add peripheral modules, Library/Transport/Canteen expansion, or new endpoints unless a listed flow cannot complete correctly without them.

The backend does not primarily need more endpoints. Existing core flows must behave correctly under:

```text
multiple tenants
+ concurrent users
+ weak/no internet
+ retries
+ duplicate requests
+ authorization changes
+ financial corrections
+ server restarts
+ queue failures
+ partial external-provider failures
```

Backend execution order for API work (overrides product P0 numbering above when sequencing backend slices):

| Priority | Work |
|---|---|
| **P0-1** | CI/build baseline completely green |
| **P0-2** | Auth, RBAC, tenant isolation, Platform vs school vs support context, assignment-scoped Teacher access, guardian-linked-student-only access, suspended-tenant fail-closed, same authorization on files |
| **P0-3** | Offline sync foundation: idempotent mutations, client operation IDs, replay-safe APIs, conflict/version/epoch checks, revoked-scope rejection, deterministic sync receipts, partial-sync recovery |
| **P0-4** | M2 Attendance correctness: assignment enforcement, device/session trust, offline draft → sync → confirmation, stale/revoked assignment rejection, conflict/correction, audit history |
| **P0-5** | Student + Guardian lifecycle: admission → enrollment → class/section, link verification, duplicate/merge, transfer/archive, document retention, iEMIS export/readiness boundary, no orphaned guardian links |
| **P0-6** | M3 Fees and Receipts: billing runs, student fee ledger, invoices, allocation, partial payments, discounts/scholarships, refunds, reversals, cashier close, receipt sequencing, receivables aging; every financial mutation transactional and idempotent |
| **P0-7** | Immutable M11 ledger: journal engine, double-entry validation, posting batches, account mappings, fiscal periods, close/reopen, reversal journals, bank reconciliation, trial balance, GL, balance sheet, income/expenditure; no destructive edits to posted records |
| **P0-8** | M3/M7 → M11 integration: source event → idempotent posting → M11; reconciliation reports for failed or incomplete postings |
| **P0-9** | Financial + authorization audit trail |
| **P0-10** | Critical notifications: event → delivery, retry/dedup, guardian-recipient isolation, delivery status, emergency path, deterministic replay of offline-created events |
| **P1** | Payroll depth, IRD/CBMS integration, reporting, operational hardening (transactions, constraints, indexes, pagination, N+1, cache, queues/DLQ, timeouts, request IDs, structured logs, metrics, health/readiness, rate limiting, backup/restore) |
| **Later** | Library, Transport, Canteen expansion |

UI normalization during P0 is allowed only when it directly improves active P0 safety, comprehension, accessibility, authorization feedback, offline recovery, or task completion.

## 5. Platform control plane and school application are separate security domains

The **SchoolOS Platform** and **School Management System** are separate application/security domains. Never model Platform as a hidden `DEVELOPER` role that sees more school menus.

They may share monorepo, backend infrastructure, PostgreSQL, Redis, storage abstractions, common packages, and deployment pipeline, but remain separate in identity, authorization, routing, UI surface, audit semantics, and support access.

### School tenant plane

School personas operate only within trusted tenant scope: Principal, Admin, Teacher, HR, Accountant, Parent/Guardian.

- `/dashboard/*` = school operations.
- `/dashboard/settings/*` = school configuration.

Principal/Admin may be highly privileged inside one school but never receive Platform capabilities, provider secrets, global flags, SaaS plan controls, infrastructure controls, or other tenants' data.

### Platform control plane

`/platform/*` is SchoolOS-internal SaaS control plane for tenant lifecycle, entitlements, subscriptions, Platform operators, provider configuration, release/feature controls, system health, support tooling, cross-tenant audit, and centrally managed compliance-profile publishing.

Use distinct trusted contexts conceptually:

```text
SchoolAuthorizationContext: tenantId + schoolUserId + roles + permissions
PlatformAuthorizationContext: platformOperatorId + platformRoles + platformCapabilities
```

Rules:

- School sessions/JWTs cannot become Platform sessions by adding a role.
- Platform capabilities cannot be assigned by school Admin/Principal.
- Platform sessions do not carry a tenant as permanent authority scope.
- Prefer distinct internal `apps/platform-web` when/if implemented.
- Separate application/security domains do not require microservices or a second primary database.

### Controlled support access

Platform operators never get ambient unrestricted tenant-record browsing. Support access must be purpose-limited and, where supported, require tenant selection, reason/ticket, module/capability scope, read-only default, expiry, step-up/approval for sensitive actions, and full audit. Emergency access is never an untracked permanent bypass.

## 6. Architecture and authorization invariants

Keep:

- NestJS modular monolith.
- PostgreSQL/Prisma.
- Redis/BullMQ.
- Next.js App Router.
- Flutter companion app.
- `packages/core` where appropriate.

Do not introduce microservices, a different primary DB/search technology, GPU infrastructure, Kubernetes, or unrelated frameworks without explicit approval.

**Owner-approved offline exception:** an Edge-enabled school may run a tenant-bound local deployment of the same SchoolOS modular monolith with local PostgreSQL, Redis/BullMQ where required, and local `StorageAdapter`. This is an offline deployment mode, not a forked product/microservice split.

Mandatory boundaries:

- `tenantId` is canonical tenancy boundary.
- Backend authorization is truth; frontend hiding is UX only.
- Never trust client-supplied tenant, role, permission, guardian relation, teacher assignment, totals, approval state, tax treatment, fiscal state, or lifecycle state.
- Fail closed for suspended tenant, disabled/missing/invalid/unavailable entitlement, unverifiable capability/assignment, inactive/revoked guardian relation, unknown fiscal policy where required, or protected-file authorization failure.
- Parent = active linked children only, per-relationship capabilities/restrictions.
- Teacher = active assigned class/section/subject/period/component only.
- Class-teacher cross-subject visibility never grants another subject's write authority.
- Staff self-service = own records unless explicitly authorized.
- Platform operator = SaaS control-plane authority; tenant data only through controlled support paths.
- Sensitive writes/support overrides are audited.

Authoritative teacher writes require explicit capabilities, not generic Teacher role. Reuse canonical capabilities such as:

```text
HOMEROOM_ATTENDANCE_MARK
PERIOD_ATTENDANCE_MARK
SUBJECT_HOMEWORK_WRITE
SUBJECT_MARKS_WRITE
CLASS_ACADEMIC_OVERVIEW
CLASS_TEACHER_REMARK_WRITE
RESULT_REVIEW
RESULT_PUBLISH
MARKS_UNLOCK
```

Never expose secrets, raw stack traces, provider/storage internals, CBMS/provider credentials, callback secrets, private object keys/URLs, unrelated student records, safeguarding records, salary/bank data, or private finance/staff data.

Never put production credentials, real student data, DB backups, secrets, or private school records in prompts, logs, fixtures, screenshots, issues, PR text, or commits.

## 7. Cross-cutting implementation rules

### Contracts and naming

- Inspect touched-area conventions before adding/renaming routes, files, DTOs, enums, schemas, clients, components, or contracts.
- TypeScript/web paths: kebab-case. Flutter/Dart: lower_snake_case. Framework-required names are exceptions.
- API paths: lowercase kebab-case resource nouns with explicit IDs such as `:studentId`.
- Lifecycle values flow `Prisma/domain → DTO → service → OpenAPI → shared contract → web/mobile`.
- Do not invent UI-only authoritative statuses.
- Preserve stable legacy names unless a compatibility plan covers DB/API/web/mobile/jobs/cache/integrations/tests.

### Files

Use:

```text
Feature module
→ FileRegistryService
→ StorageService
→ StorageAdapter
```

No provider SDKs in feature modules, normal DB base64 file storage, raw private-file browser opens, or exposed object keys/private URLs.

### Notifications / notices

Feature modules emit normalized events; they do not call providers directly.

- M12 owns recipient resolution, templates, preferences, channel routing, jobs/retries/callbacks, read/ack state, diagnostics, delivery audit.
- M15 owns notice draft/approval/audience/version/publish/withdraw semantics.

### Money and immutable financial ledger

M3 Fees & Receipts and M7 Payroll own source business transactions; M11 Accounting & Finance owns accounting truth.

Authoritative runtime totals are authoritative. Official totals are never independently recomputed in browser/mobile.

Once a financial document/transaction crosses its authoritative boundary (`ISSUED`, `CONFIRMED`, `APPROVED`, `POSTED`, or canonical equivalent):

- no ordinary destructive update/delete;
- corrections use explicit linked credit note, debit note, refund, reversal, adjustment, reclassification, or replacement;
- preserve `original → correction/reversal → replacement` lineage, reason, actor, approval, timestamps, source module, period, supporting document, audit events;
- issued invoice/receipt/voucher numbers are never reused;
- reprints preserve original identity and are auditable;
- journals remain balanced;
- M3/M7→M11 posting is idempotent;
- duplicate event/callback/queue replay returns existing result rather than posting twice;
- closed periods fail closed; reopen requires capability, reason, approval where required, audit, and re-lock;
- Platform/support access never gets a hidden rewrite bypass;
- protect posted facts at API/service/database layers.

Do not use blockchain merely to call the ledger immutable. Prefer PostgreSQL transactions, append-only posted facts, constraints, idempotency, explicit correction/reversal records, audit history, backups, and optional later tamper-evident hashing.

External payment-provider actions require connectivity and remain pending/queued until verified.

## 8. Nepal IRD / fiscal compliance

SchoolOS is Nepal-only. M3, M7, M11, School Edge, fiscal documents, and Nepal Compliance Profile treat Nepal IRD/Ministry of Finance requirements as **versioned external policy**, not hard-coded constants.

### Authority and evidence

Before changing any tax, levy, VAT, TDS, payroll deduction, invoice format, CBMS, electronic-billing, fiscal-year, or statutory-report behavior:

- verify current official IRD/MoF/Nepal Gazette/controlling Act/Rule/Procedure/notice;
- store legal/official source, publication/effective date, applicability, reviewer, and evidence location;
- do not rely on blogs/vendor docs/accountant memory/old fixtures when a current official source exists;
- never label SchoolOS/tenant/document/calculation/connector `IRD compliant`, `VAT compliant`, `TDS compliant`, `CBMS compliant`, etc. without evidence for that exact behavior;
- if uncertain/recently changed, preserve business data but block false fiscal-final state and surface `needs IRD verification`.

### Effective-dated fiscal policy

Do not scatter Nepal tax/levy rates or invoice rules through feature code. Use the Nepal Compliance Profile/canonical equivalent:

```text
TaxAuthorityRule / FiscalPolicyVersion
authority
legalReference / gazetteReference
ruleType
appliesTo / taxpayerThreshold
effectiveFrom / effectiveTo
rate / exemption / treatment
invoiceRequirement
cbmsRequirement
documentTemplateVersion
status = DRAFT | REVIEWED | ACTIVE | EXEMPTED | SUPERSEDED
evidence
```

Historical transactions retain the policy version used. Later law changes never rewrite historical facts.

**Mandatory volatility test:** FY 2083/84 introduced an Education Equity Fee for private educational institutions and later a Gazette notice granted full exemption. SchoolOS must support introduce/change/exempt/supersede without code edits or destructive receipt changes. Already-collected amounts follow legally valid refund/reversal/adjustment workflow while preserving originals.

### Billing and fiscal documents

Every fee collection is traceable:

```text
charge/invoice
→ payment
→ receipt/fiscal document
→ M11 posting
→ audit history
```

- Fiscal identity supports legal entity/school name, PAN, registration/tax treatment, approved series, fiscal year, branch/site where applicable, and policy-required fields.
- Issued fiscal documents are not deletable.
- Post-issue correction uses credit/debit note or legally required equivalent linked to original.
- Do not collect/display VAT because a generic template has a tax field.
- VAT-exempt education treatment does not automatically exempt PAN, income tax, payroll/TDS, billing, recordkeeping, CBMS, or other obligations.
- Keep payment state separate from fiscalization state: `PAYMENT_CONFIRMED` ≠ `IRD/CBMS_CONFIRMED`.

### Electronic billing, enlistment, CBMS

Current 2083/84 baseline must be treated as versioned policy, not permanent constant: IRD's 4 Baisakh 2083 notice states, subject to its exceptions, taxpayers above **NPR 20 crore annual turnover** must issue electronic invoices and connect them to CBMS at issuance. Re-verify threshold/applicability before implementation, tenant activation, or release.

- Determine CBMS applicability per tenant/legal entity/fiscal period from verified policy/evidence; never from `institutionType === SCHOOL`.
- Protect CBMS credentials; never expose to school clients/mobile/logs/exports/prompts/general support.
- Electronic-billing software/tenant approval or IRD software-enlistment status is explicit. Installing SchoolOS is not evidence of authorization.
- Government/provider response is external truth. Store request/idempotency IDs, attempts, acknowledgement/reference, rejection code, timestamps, reconciliation state.
- CBMS retry is idempotent and never creates a second fiscal document.

### Offline/School Edge fiscal behavior

Offline-first does not remove external IRD obligations.

- Separate local business/accounting authority from external fiscalization/CBMS confirmation.
- Edge may continue permitted local fee/cash/accounting/receipt workflows only to extent allowed by current verified fiscal policy.
- If policy requires CBMS connection at issuance, do **not** assume `issue now, upload later` is lawful.
- Implement only official/approved outage procedure for that taxpayer/software.
- If outage procedure is unknown, preserve business transaction but hold fiscal document in truthful pending/blocked state such as `PENDING_FISCALIZATION`; never claim final IRD/CBMS acceptance.
- Preserve fiscal-number uniqueness across cloud/Edge failover with approved allocation/fencing.
- Reconnect reconciliation compares fiscal documents, M11 postings, CBMS acknowledgements, payment-provider evidence, and sequence continuity; mismatches require explicit resolution.

### Payroll/TDS/statutory deductions

M7 may calculate payroll and M11 may post it, but TDS, SSF, PF/EPF, CIT, gratuity, festival allowance, and other Nepal statutory behavior remain versioned/configurable and require current qualified Nepal accounting/legal verification before compliance claims.

Preserve taxable/non-taxable components, policy version, calculation inputs, overrides, approval, posting, payment, correction/reversal, and statutory-report evidence. Never hide a statutory difference by editing a posted payroll run.

### Minimum P0 fiscal controls

Where applicable:

1. Immutable issued invoice/receipt/fiscal documents.
2. Credit/debit-note, refund, reversal, replacement lineage.
3. Invoice/receipt sequence uniqueness and exception reporting.
4. Versioned Nepal tax/levy/exemption policy with official evidence.
5. PAN/legal-entity/fiscal identity.
6. Explicit VAT/tax treatment.
7. CBMS applicability/activation evidence.
8. CBMS idempotency/acknowledgement/rejection/reconciliation.
9. Electronic-billing/software-enlistment/tenant-approval status.
10. Offline/Edge fiscalization and numbering with no false success.
11. Idempotent M3/M7→M11 posting and complete fiscal audit trail.
12. Qualified review/evidence for payroll/TDS statutory schedules.

Any touched fiscal workflow tests applicable duplicate issuance/replay, update/delete rejection after issue, correction lineage, sequence uniqueness, wrong PAN/tax config, effective-date boundary, policy supersession/exemption, CBMS required/not-required, timeout/retry/rejection/duplicate acknowledgement, Edge outage/reconnect, authority failover numbering, duplicate source-to-M11 prevention, period close/reopen, refund/reversal accounting, and audit/export traceability.

## 9. Product UI / UX design governance

SchoolOS UI is a **role-aware school operating workspace**, not a generic ERP dashboard.

Canonical interaction hierarchy:

```text
Context
→ Attention
→ Action
→ Work
→ Status / Evidence
→ Analytics only where decision-useful
```

Every operational screen should answer:

1. Where am I?
2. What requires attention?
3. What can I safely do?
4. What is the current authoritative/local state?
5. What evidence proves the result?

Visual target: **calm institutional clarity with premium SaaS polish**.

### Design-system layering

```text
tokens
→ components
→ patterns
→ feature composition
→ persona-specific routes
```

Features compose patterns; patterns compose components; components consume tokens.

Do not create:

- arbitrary one-off hex/shadow/radius systems;
- giant page-specific global CSS;
- duplicate primitives when a shared component can be extended;
- imported UI architecture from benchmark repos/products.

External products are benchmark patterns only. Never import their branding, curriculum scope, permission model, components, dependencies, or information architecture into SchoolOS.

### Visual tokens and semantics

Keep SchoolOS blue/navy operational identity.

Baseline intent:

```text
brand-navy       #17324D
primary-600      #2563EB
primary-700      #1D4ED8
primary-50       #EFF6FF
canvas           #F4F7FB
surface-subtle   #F8FAFC
surface          #FFFFFF
text-primary     #172033
text-secondary   #667085
text-muted       #98A2B3  decorative/disabled only
border-subtle    #DDE4EC  divider only
border-control   #7C8799  interactive boundary where required
```

Contrast-safe semantic foreground/soft pairs:

```text
success #18794E / #E8F5EE
warning #8A5800 / #FFF4D6
danger  #B42318 / #FEECEB
info    #175CD3 / #EBF2FF
neutral #475467 / #F2F4F7
```

Rules:

- `text-muted` is not normal operational/instructional text.
- `border-subtle` is not the only visual cue for a control.
- Green = success/healthy; amber = attention; red = error/blocked/destructive; blue = routine action/information.
- Module identity never overrides semantic meaning.
- Color is never the only status cue.
- Data-visualization colors are separate from semantic colors.
- Tenant branding may affect login/identity/documents/report cards/receipts/notices/restrained accents but never overrides primary action, semantic, focus, destructive, validation, or control-boundary tokens.

### Typography, geometry, motion

Preferred authenticated typography direction:

```text
Inter
+
Noto Sans Devanagari
```

Use existing canonical values where already implemented; otherwise normalize approximately:

```text
topbar                 64px
sidebar expanded       248px
sidebar collapsed       72px
desktop padding         24px
tablet padding          20px
mobile padding          16px
section gap          20–24px
desktop control         40px
important/mobile     44–48px
button/input radius      8px
panel radius             12px
overlay radius           16px
```

Prefer borders over heavy shadows. Avoid glassmorphism, gradient-heavy ERP, giant rounded wrappers, decorative parallax, slow editorial reveals.

Motion is restrained (~100/160/220/280ms for instant/fast/standard/overlay) and honors reduced motion.

### Shell/navigation

Persistent global shell may expose:

- SchoolOS/school context;
- academic year/context where relevant;
- search where supported;
- sync/connectivity;
- notifications;
- account.

Group school web navigation by work, not one giant module list:

```text
HOME
STUDENTS
DAILY OPERATIONS
ACADEMICS
PEOPLE & FINANCE
REPORTING
SYSTEM
```

Exact items remain persona/permission/entitlement/module scoped. Navigation never broadens API authority.

Parent remains mobile-only. Do not create Parent web for symmetry. Do not create a broad Student product from benchmark research.

### Canonical page grammar

```text
Page
├── ModuleHeader
│   ├── breadcrumb/context
│   ├── title
│   ├── one-sentence purpose
│   ├── state/context
│   ├── one dominant primary action
│   └── secondary/more actions
├── attention / summary      optional
├── workspace tabs           optional
├── filters / search         optional
└── WorkSurface
    ├── primary work
    ├── state/recovery
    ├── pagination
    └── detail/drawer
```

One screen = one main job.

### Canonical workspace families

| Family | Typical use |
|---|---|
| Executive monitoring | Principal, Platform, selected Accounting overview |
| Operational dashboard | Admin, HR, Accountant |
| Directory | Students, Staff, Guardians |
| Queue / case review | Admissions, approvals, corrections |
| Transaction counter | Fees, receipts, refunds |
| Spreadsheet / grid | Attendance, marks, payroll, reconciliation |
| Builder + preview | Homework, notices, timetable/configuration |
| 360° record | Student, staff, guardian |

Use real tables when row/column relationships matter and a true keyboard-capable grid when repeated cell editing is the job. Do not force card layouts onto marks, attendance, ledger, or large queues.

### Persona-specific dashboards

Do not build one dashboard and merely hide cards.

- **Principal:** leadership attention, approvals, readiness, major exceptions, only decision-useful trends.
- **Admin:** unfinished office queues, data issues, readiness, bounded quick actions.
- **Teacher:** **Today** first — classes, attendance due, homework, marks deadlines, substitutions, sync issues. No revenue/admissions analytics.
- **HR:** absence, leave/contract work, staff issues, payroll readiness.
- **Accountant:** collections, receivables, reconciliation, fiscal/ledger exceptions, failed/unposted source transactions, close readiness.
- **Platform Operator:** tenants, providers, queues, releases, health, backups/security; separate Platform control plane.
- **Parent mobile:** active child, today's status, homework, fees, published results, notices. Never mini Admin ERP.

Dashboard composition remains server/persona projected where that architecture exists. KPIs/counts/readiness/money/trends are authority-owned. Never fabricate analytics, fake zeroes, derive official totals from broad client lists, or load unauthorized data just to hide it.

Preferred rhythm:

```text
context/header
→ compact summary
→ needs attention / next action
→ today's work / queue
→ readiness / evidence
→ recent activity
→ selective trend
```

Charts are not decoration. Use only when trend/distribution/comparison materially improves a decision.

### Forms/tables/grids/statuses

Forms:

- visible sections, explicit labels, helper text;
- long workflows use bounded steps/task navigation;
- error summary + field errors;
- preserve entered data;
- no color-only error state.

Tables:

```text
heading + count
→ search / filters / actions
→ native table
→ selection actions
→ authoritative pagination
```

Typical density: ~48px directory/queue, ~44px finance, 40–44px grid. Do not squeeze wide desktop tables into mobile.

Editable grids require explicit keyboard behavior, validation, and programmatic error semantics.

Status labels use sentence case and are normally noninteractive:

```text
Paid
Pending
Overdue
Draft
Submitted
Approved
Locked
Failed
Pending fiscalization
Conflict
Offline
```

Status and action are separate concepts.

### Offline/Edge visual truth

Show truthful connectivity/authority state:

```text
● Online
● School Edge · Internet unavailable
◌ Syncing · 3 changes
○ Offline · 5 changes saved locally
⚠ Sync conflict · Review required
```

Distinguish:

```text
Draft saved
Saved on this device
Queued
Syncing
Accepted by authority
Synced
Locked / Posted / Published
```

Never show `Synced`, `Submitted`, `Posted`, `Published`, `IRD/CBMS confirmed`, etc. before relevant authoritative acceptance.

Every significant surface defines applicable canonical states:

```text
loading
empty
ready
validation-error
permission-denied
module-disabled
tenant-suspended
local
queued
syncing
synced
stale
conflict
rejected
revoked
failed
partial-failure
provider-pending
pending-fiscalization
protected-file-unavailable
```

### High-risk operation UX

For payment/refund/reversal/cashier close/payroll/journal/voucher/fiscal/period reopening/marks publication-unlock/guardian-custody/permission and equivalent writes:

1. Show exact target/scope.
2. Show authoritative amount/current state.
3. Show resulting state.
4. Require reason/approval/step-up when policy requires it.
5. Allow review/correction before final submit where possible.
6. Return authoritative result, never optimistic fake success.
7. Preserve audit/fiscal/offline recovery context.

Payment success never visually implies accounting posting or CBMS fiscalization also succeeded.

### Accessibility baseline

Target **WCAG 2.2 AA** and equivalent mobile accessibility:

- normal text contrast ≥ 4.5:1 where applicable;
- large text ≥ 3:1;
- meaningful non-text UI/graphic contrast ≥ 3:1;
- color never sole state cue;
- visible keyboard focus;
- sticky shell must not fully obscure focused controls;
- prefer 40–44px operational controls and 44–48px mobile/high-priority targets;
- 320px-equivalent reflow except genuine 2D data contexts;
- text zoom/scaling without functional loss;
- explicit labels/hint/error associations;
- keyboard-accessible table/grid/actions;
- dialog focus management;
- reduced-motion support;
- real Nepali/Devanagari wrapping, line-height, truncation, and screen-reader QA;
- no hover-only critical actions;
- no gesture-only critical mobile action without alternative.

### P0 UI scope

Allowed during P0 when directly improving active P0:

- contrast-safe tokens;
- grouped navigation/shell consistency;
- `ModuleHeader`/page grammar;
- shared loading/empty/error/permission/offline/conflict states;
- forms/tables/grids/validation;
- persona-safe dashboard composition required by active workflows;
- Attendance workstation;
- Fees/receipt high-risk flow;
- offline/Edge state language;
- accessibility/responsive correctness.

Do not start giant theme replacement, decorative redesign, glass/gradient treatment, public-site redesign, dashboard chart expansion, role-unsafe personalization, or broad component rewrite merely for polish while P0 blockers remain.

### UI verification

For materially touched UI verify applicable:

- persona/permission/entitlement/tenant scope;
- desktop/tablet/mobile;
- keyboard/focus;
- real English/Nepali strings;
- loading/empty/error/permission/module-disabled;
- online/Edge/offline/local/queued/sync/conflict;
- high-risk review/recovery;
- table/grid keyboard behavior;
- no cross-persona metrics;
- no fake/demo production data/KPI/false success;
- shared tokens/components/patterns;
- no critical hover-only action;
- `context → attention → action → work → status/evidence`.

A polished screen that weakens authorization, hides stale/offline/fiscal state, obscures evidence, invents data, or makes the main job harder is a regression.

## 10. Web and mobile rules

### Web

- Real APIs only; no fake production data.
- Offline-first/installable where practical.
- Cache app shell + approved tenant/user projections only.
- Persist approved local drafts/queues across reload/restart.
- If Edge reachable while internet unavailable, continue normal tenant operations against Edge using same contracts/auth.
- If neither cloud nor Edge reachable, continue from protected local cache/queue; shared authoritative finalization waits.
- Paginate growing lists at authoritative runtime; never preload whole tenant for offline.
- Handle loading, empty, error, permission, module-locked, local, queued, syncing, stale, conflict, rejected, revoked, partial-failure, file-unavailable.
- High-risk actions require confirmation/reason where required.
- KPIs are authority-owned, time-bound, actionable, honest.

### Mobile

- Companion app; persona-first, purpose-limited APIs; no admin-shaped payloads.
- Local-first after provisioning/sync.
- Support cloud-online, School Edge/LAN, intermittent, fully disconnected.
- Approved writes use stable operation IDs.
- Show local/queued/syncing/synced/stale/conflict/rejected/revoked/failed.
- Tenant/child/assignment/access changes invalidate no-longer-authorized local data/queued writes once learned.
- No network round trip merely to open app, switch among already provisioned children/schools, inspect cache, create approved draft, review queue.

Biometrics for Parent/Teacher/Principal:

- school-issued initial credentials via approved channel;
- after first successful mobile login prompt Face ID/fingerprint;
- optional; skip and enable later;
- credential/password fallback;
- device-local unlock only; no raw biometric templates;
- logout/session revoke/account recovery/device replacement/permission loss invalidates protected local access appropriately.

## 11. Offline-first operation and School Edge

Offline-first is required for School Management System and mobile.

```text
Mode A — Cloud online
Web/mobile → Cloud authority

Mode B — Internet unavailable, school LAN available
Web/mobile → School Edge authority → local PostgreSQL/Redis/storage
Edge queues replication/provider work

Mode C — Fully isolated device
Web/mobile → protected local cache + operation queue
Approved work continues locally; shared finalization waits
```

Network loss is not a generic fatal error.

### School Edge runtime

- Reuse same NestJS modules/domain services/contracts as cloud.
- Tenant-bound local PostgreSQL is authoritative operational DB while Edge authority active.
- Local Redis/BullMQ where current jobs require it.
- Local `StorageAdapter` under File Registry/StorageService.
- Bind Edge to explicit tenant/site; never cross-tenant Platform node.
- Encrypt local secrets/sensitive data.
- Expose local health/capacity/backup/queue/replication lag/last-cloud-sync.
- Same schema/contracts/migrations as cloud; rollback-aware.

### Write authority / split-brain

For Edge-enabled tenant/site:

- one active authoritative writer model;
- track `authorityNodeId` + `authorityEpoch`/fencing token;
- cloud/Edge never silently finalize same aggregate under conflicting epochs;
- failover/promotion explicit, audited, fenced;
- stale node cannot resume after newer epoch;
- stable operation IDs + aggregate/entity versions;
- replay idempotent;
- never auto-merge conflicting authoritative histories for money/fiscal docs/attendance finalization/marks/results/guardian-custody/payroll/permissions/accounting;
- quarantine conflicts and use explicit reconciliation/correction.

### Core workflows during internet outage

When Edge reachable and normal auth/entitlement/lock/fiscal rules allow:

- M0 school-side identity/session/config reads/audit/local files/jobs.
- M1 admissions/student/guardian and protected docs.
- M2 attendance capture/submit/finalize/lock/correction.
- M3 permitted invoice/cash/manual-bank/receipt/cashier/refund/reversal/reconciliation.
- M4 marks/review/lock/results/report cards when data/policies local.
- M5 activities/milestones/local media processing.
- M6 homework/timetable.
- M7 HR/attendance/leave/payroll.
- M11 journals/vouchers/ledger/reporting/period operations.
- M12 local in-app state/delivery queue creation.
- M15 notice drafting/approval/local publication.

Offline never bypasses authorization, audit, academic integrity, accounting, or fiscal rules.

External dependencies remain pending when unreachable: payment gateways/callback verification/settlement, CBMS/IRD submission where connectivity required, SMS/email/push/voice, direct IEMIS/government APIs, remote webhooks, cloud-only Platform support, remote storage replication, cloud telemetry/backups.

Use truthful states: `pending-connectivity`, `pending-fiscalization`, `queued-for-provider`, `awaiting-verification`, `delivery-deferred`, or canonical equivalent.

### Fully isolated device

Provisioned client may:

- browse authorized cached persona data;
- create/edit supported local drafts/queued ops;
- capture attendance/homework/activity/remarks/forms/requests/file references where supported;
- prepare high-risk work only as local pending operation under dedicated offline contract;
- inspect queue/sync/conflict/freshness.

Isolated client never claims shared high-risk/fiscal/financial/academic record is officially finalized until authority accepts it.

### Offline auth/scope

- First provisioning/sign-in requires trusted authority unless already provisioned offline.
- Edge may authenticate locally provisioned school users.
- Mobile may unlock protected local session via configured biometric/device fallback.
- Cache signed/versioned offline authorization snapshot with only required scope/freshness.
- Local auth never grants more than last trusted snapshot.
- Revocation applies immediately on Edge and propagates when clients connect.
- Sensitive capabilities should use bounded offline auth lease/grace rather than unlimited stale authority.
- Offline cannot manufacture Platform Operator, tenant, entitlement, permission, guardian relation, or teacher assignment.

### Sync envelope

Use canonical equivalents of:

```text
operationId / clientOperationId
originNodeId
authorityNodeId
authorityEpoch
deviceId
tenantId
userId
persona/context
authorizationVersion / assignmentVersion
aggregate/entityId
baseEntityVersion / expectedVersion
occurredAtClient / createdAtClient
acceptedAtAuthority
localSequence / authoritySequence where relevant
syncAttemptCount
syncStatus
payloadVersion
```

Client timestamps are diagnostic only; never override authoritative time, period, lock, deadline, fiscal date, sequence, or authorization.

### Synchronization

1. Discover active trusted authority.
2. Authenticate node/device + tenant binding.
3. Exchange cursors/checkpoints/schema/contracts.
4. Push immutable outbox ops/events.
5. Dedupe by stable operation/event ID.
6. Validate authority epoch, auth snapshot, versions, locks, entitlements, fiscal/business invariants.
7. Accept atomically or explicit reject/conflict.
8. Pull authoritative changes/revocations/tombstones.
9. Reconcile local projections.
10. Sync protected files by stable identity/content hash.
11. Resume provider/government jobs only when connectivity/readiness exists.
12. Persist restart-safe checkpoints.

Sync is resumable, batched/chunked, bandwidth-aware, safe through repeated disconnect/reconnect.

### Conflict rules

- Duplicate replay → original result.
- Safe deterministic merge only when domain defines it.
- Base version changed → conflict; retain authoritative and local intent.
- No last-write-wins for attendance/marks/results/finance/fiscal/payroll/accounting/guardian-custody/permissions.
- Revoked guardian/assignment/permission → rejected/revoked; stop retry; purge unauthorized projection.
- Tenant suspended/module disabled → stop writes when authority knows.
- Schema/contract mismatch → block replication/upgrade-required; no coercion.

### Local storage / queues / backup

- Store only persona/offline scope; not whole tenant on every device.
- Partition by tenant + user + persona/context + site/child/assignment where relevant.
- Protect auth material with secure storage; sensitive local datasets with approved protected/encrypted storage.
- Track source authority, snapshot/version, `lastSyncedAt`, stale state.
- Logout/switch/revocation removes/quarantines affected cache/queues.
- Persist outbox across restart.
- Bounded retry/backoff; permanent validation/authz/fiscal failures not retried forever.
- Jobs classify local-safe/connectivity-required/cloud-only.
- Edge supports encrypted local backup/restore.
- Restored node validates authority epoch/replication position before authoritative writes.

### Offline verification gates

A feature claiming offline support tests applicable:

- high latency/intermittent;
- internet loss with Edge reachable;
- total isolation;
- browser/app/device/Edge restart;
- queue persist/resume;
- duplicate replay;
- large backlog;
- out-of-order/partial delivery;
- concurrent authoritative change;
- authority failover/fencing/stale-node rejection;
- expired session/offline unlock;
- guardian/teacher/role revocation before sync;
- tenant/module disable before sync;
- fiscal/receipt numbering uniqueness;
- marks/attendance/finance/accounting conflicts;
- protected-file replication;
- provider/CBMS outage while core safe workflow continues;
- no cross-tenant/user/child leakage;
- convergence/audit consistency after reconnect.

Cached pages alone are not offline completion.

## 12. Missing API decision rule

If web/mobile/platform needs data and no safe API exists:

1. Inspect code, OpenAPI/contracts, permissions, DTOs, Prisma, services, tests.
2. Confirm need is real, repeatable, module-owned, tenant-scopable, entitlement/RBAC-gatable, and needed for active P0.
3. If yes, implement smallest purpose-limited module-owned API and connect it.
4. If no, show safe unavailable/locked/permission state and record exact gap.

Never invent endpoint contracts/response shapes, derive authoritative totals from list APIs, or show developer-facing "Needs backend API" in school UI.

Use explicit uncertainty labels when needed:

```text
needs backend verification
needs OpenAPI confirmation
needs mobile DTO
needs idempotency confirmation
needs offline sync confirmation
needs authorization confirmation
needs IRD verification
```

## 13. Before coding

1. Read focused instructions/canonical docs/current implementation.
2. Inspect OpenAPI/contracts, Prisma, DTOs, permissions, audit, API clients, migrations, focused tests.
3. For Nepal fiscal/statutory changes, verify current official IRD/MoF/Gazette evidence.
4. For material UI changes, inspect existing tokens/components/patterns and active persona/workflow.
5. Identify smallest safe P0 change.
6. Reuse architecture; do not duplicate services/endpoints/DTOs/models/components/docs/design systems.
7. Do not rewrite working modules without verified defect/approved reason.
8. Do not modify unrelated files or weaken tests/validation.
9. Update focused tests for behavior changes.
10. Paginate growing lists; avoid unbounded `findMany`; use selective/aggregate queries and tenant-scoped indexes.
11. Return safe error envelopes; never expose raw technical errors.
12. Run relevant checks and report exact results.

If security, finance, fiscal, privacy, academic integrity, authorization, or offline authority remains unresolved after canonical inspection, mark slice PARTIAL/BLOCKED rather than inventing behavior; continue independent safe work.

## 14. Definition of done

Development complete requires where applicable:

- real persistence; no fake production data;
- server-side tenant/RBAC/entitlement/persona/assignment/guardian enforcement;
- suspended tenants/disabled modules fail closed;
- sensitive writes/support overrides audited;
- money idempotent; issued/posted history immutable with explicit corrections;
- IRD/fiscal policy effective-dated/evidence-backed;
- electronic-billing/software-enlistment/CBMS evidence recorded before compliance claims;
- offline fiscalization never fabricates government success;
- attendance/marks lifecycle/correction preserved;
- notification state honest;
- protected-file architecture respected;
- growing lists paginated;
- web/mobile/offline states complete;
- cache/access revocation handled;
- touched UI uses shared tokens/components/patterns and correct persona/accessibility/offline/high-risk behavior;
- focused regression/cross-tenant/role/assignment/guardian/idempotency/fiscal/offline/UI-state tests updated;
- relevant checks pass or failures reported exactly.

Staging/pilot/RC/GA additionally requires evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, including staging migration/config, provider/storage/CBMS readiness where relevant, authenticated browser E2E, mobile/Edge QA, backup/restore, monitoring/alerts, rollback, controlled-pilot evidence.

## 15. Verification

Run relevant gates and report exact commands/results:

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
pnpm smoke:full
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
cd apps/schoolos_mobile && flutter pub get && dart format . && flutter analyze && flutter test
```

Run Platform/Edge/fiscal connector checks only if those apps/profiles exist or are touched. For material UI work, run repository-supported accessibility/responsive/browser verification.

`pnpm smoke:learning` is relevant only for allowed M13 security/regression fixes; M13 remains frozen.

Docs-only changes need no runtime checks unless executable commands/config/contracts/release procedures changed.

## 16. Progress format

```text
Release stage:
Current P0 slice:
Current module:
Completed:
Remaining P0 blockers:
Risks:
Verification run:
Verification result:
IRD/fiscal evidence (if applicable):
Offline/Edge evidence (if applicable):
UI/accessibility evidence (if applicable):
Staging/pilot evidence:
Deferred/not touched:
Next release action:
```

Report verified facts only. Distinguish implementation completion, local verification, fiscal evidence, tenant activation evidence, offline/Edge evidence, UI/accessibility evidence, staging/pilot evidence, and unresolved blockers.
