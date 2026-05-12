# SchoolOS Current Repo Status Analysis

This document is the short current-state audit for backend implementation, modules, phases, and repo readiness.

For the full source of truth, read:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Do not treat older Phase 1B / Phase 2-transition notes as current unless they are explicitly marked as historical.

---

## Current Consolidated Verdict

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation: Completed across eight sprints
Phase 2A M4 Academics backend: Completed / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + M0 platform foundation complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

CTO verdict:

```text
SchoolOS is beyond MVP.
The backend/module surface is broad and architecturally strong.
M0 Platform Core is now implemented as a real platform foundation, not just a roadmap item.
The next priority is stabilization, Docker-backed smoke verification, browser smoke coverage, M0 regression coverage, and one-vertical-at-a-time hardening.
Do not expand broad new modules until the full repo verification gate is clean.
```

---

## Current Module Completion Estimate

| Module | Estimated Completion | Current Implementation State |
|---|---:|---|
| Auth / RBAC / Tenant Isolation | 90-95% | Cookie-first auth, bearer support, RBAC, tenant context, super-admin override audit. |
| M0 Platform Core | 80-90% | Platform tenant management, entitlements/usage, SaaS billing foundation, providers/queues, file registry, reports/exports, health, onboarding implemented; deeper queue topology, E2E, seed, async reporting hardening remains. |
| M1 Admissions & Student Profiles | 90-95% | Admission, student profile/detail/edit, guardian edit, lifecycle, documents, photo/document access, roster exports. |
| M2 Smart Attendance | 85-90% | 3-tap attendance, history, monthly register, exports, correction/sync guardrails. |
| M3 Fees & Receipts | 85-90% | Invoices, payments, receipts, ledger, cashier close, reports, reversal/correction foundation. |
| M4 Academics / Exams / CAS / Report Cards | 80-90% | Backend complete and contract-protected; admin frontend/browser tests still needed. |
| M5 Activity Feed & Milestones | 75-85% | Posts, targeting, media access, moderation/soft-delete, compression queue scaffold, consent direction. |
| M6 Homework & Timetable | 60-70% | Foundation, conflict/lifecycle services, guardrails; recent schema/service/test drift needs verification. |
| M7 HR & Payroll | 65-75% | Staff lifecycle, contracts, salary structures, payroll lifecycle, payroll-to-accounting tests. |
| M8A Library | 45-55% | Admin catalog/copy/issue/return/report foundation; deeper fines/reports/tests later. |
| M8B Transport | 45-55% | Route/vehicle/driver/student assignment, trips, GPS latest-location cache foundation; driver/live map later. |
| M8C Canteen | 45-55% | Menu, meal plans, serving, wallet, POS, spending control, report foundation; inventory/vendor/accounting later. |
| M9 Accounting & Finance | 95-100% | Production-candidate complete: ledger, reports, fiscal periods, reversals, bank reconciliation, UI. |
| M10 Notices / Communication / Chat | 85-90% | Notices, delivery, retry/read tracking, consent, notification center, parent-teacher chat foundation. |
| M11 School Intelligence / AI | 0% | Roadmap only; implementation deferred until reliable production data exists. |

---

## M0 Platform Core Completion Snapshot

M0 Platform Core was completed across eight implementation sprints:

```text
1. Platform Tenant Management
2. Entitlements + Usage
3. SaaS Billing
4. Providers + Queues
5. File Registry
6. Reports / Exports
7. Observability / Ops
8. Pilot Onboarding
```

Implemented M0 capabilities:

```text
- Tenant list/detail/dashboard/status flows.
- Reason-required tenant suspend/activate behavior.
- Audited support override reason.
- Plan, feature, subscription, override, and usage-counter foundations.
- Explainable entitlement checks and usage-limit surfaces.
- Manual tenant billing profile.
- SaaS invoices, invoice lines, payments, and cancellation rules.
- Provider config masking and secret-safe response shape.
- Queue health and audited retry endpoint.
- Upload validation and dangerous extension blocking.
- Private/protected file URL response shape.
- Report export history and audited export persistence where available.
- Platform health summary for DB, Redis, queues, and object storage readiness.
- Computed tenant onboarding checklist.
- School settings onboarding page.
- Platform tenant onboarding visibility.
```

Implemented M0 models:

```text
PlatformPlan
PlatformPlanFeature
TenantSubscription
TenantFeatureOverride
UsageLimit
UsageCounter
TenantBillingProfile
SaaSInvoice
SaaSInvoiceLine
SaaSPayment
ProviderConfig
ReportExport
TenantOnboardingChecklistOverride
```

Verification snapshot from the M0 completion pass:

```text
Passed:
- pnpm db:generate
- pnpm db:validate
- pnpm verify:openapi
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm verify:production

Notes:
- verify:production passed after rerun with approval because sandbox blocked Playwright local port binding.
- pnpm smoke:phase1 did not pass because local Postgres, Redis, and API were not running.
- Focused platform/auth/report/settings tests passed.
```

Remaining M0 hardening risks:

```text
- Queue health has the production API/audit surface, but live BullMQ failed-job inspection should be wired deeper per deployed queue topology.
- Report/export history is standardized, but heavy async generation can be expanded module by module.
- Provider test connection is intentionally conservative and avoids paid/external calls.
- Demo Nepal tenant seed was not broadly expanded in the M0 pass.
- Credentialed web E2E routes were skipped where seeded credentials were unavailable.
- Platform/school route denial browser tests still need to be added.
- SaaS billing lifecycle tests still need more depth.
- Entitlement enforcement tests against real school APIs still need more depth.
```

---

## Phase-Wise Status

### Phase 0 — Foundation

Status: **Completed**.

Includes monorepo, NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, auth/RBAC, tenant context, Docker/dev verification, and production verification foundations.

### M0 — Platform Core / SaaS Starter

Status: **Foundation completed across eight sprints; pilot hardening next**.

Implemented enough for platform owner operations, tenant visibility, plan/usage foundations, SaaS billing records, provider/queue readiness, report export history, health summary, and tenant onboarding visibility.

Remaining work is hardening, deeper E2E coverage, queue topology detail, and production seed/staging verification — not broad architectural rewrite.

### Phase 1A — Core Live-School Workflows

Status: **Completed / Pilot-Ready**.

Implemented enough for live-school basics:

```text
Students/admissions
Attendance
Fees/receipts
Activity feed
Notices/communication
Dashboard shell
```

### Phase 1B — Operational Depth

Status: **Completed / Pilot-Ready with polish still useful**.

Implemented detail pages, edits, lifecycle actions, reports/exports, notification center, global search, cashier close, document/photo/media foundations, and PDF functionality.

Remaining polish:

```text
Final iEMIS export validation
Duplicate merge depth
Logo/photo UX polish
Final PDF visual polish
Full authenticated Playwright smoke coverage
```

### Phase 2 — Academics, Timetable/Homework, HR/Payroll, Accounting, Communication Expansion

Status: **Partially complete**.

Strongest completed areas:

```text
Phase 2A M4 Academics backend: complete / contract-protected
Phase 2D M9 Accounting: production-candidate complete
```

Foundations needing depth:

```text
M6 Homework & Timetable
M7 HR & Payroll
M10 Parent-Class Teacher Chat
```

### Phase 3 — Extended Operations

Status: **Admin foundations implemented; production depth incomplete**.

Implemented foundations:

```text
Library admin foundation
Transport admin/trip/location foundation
Canteen admin/wallet/POS foundation
```

Deferred:

```text
Parent/mobile portal
Driver app
Live map / WebSocket / SSE transport UI
Full canteen inventory/vendor/profit-loss
Deeper Phase 3 reports and accounting integrations
```

### Phase 4 — AI, Analytics, Scale, Enterprise

Status: **Roadmap only**.

Do not implement AI/ML yet. Start only after reliable production data and M11 intelligence foundations exist.

---

## Commit / PR History Interpretation

Recent repo history shows these waves:

```text
1. Bootstrap and production foundation.
2. Architecture/project memory/phase docs.
3. Phase 2A Academics implementation and hardening.
4. Phase 3 Library/Transport/Canteen foundations.
5. M0 Platform Core implementation and hardening.
6. Module guardrail and DB-trigger hardening across M1-M10.
7. M9 Accounting and Payroll/Finance integration coverage.
8. Verification-fix wave around Homework/Timetable, Academics controller return types, and Timetable tests.
```

Important latest observation:

```text
M0 Platform Core foundation now includes platform tenant management, entitlements, usage, SaaS billing records, provider/queue readiness, file registry hardening, report exports, health, and onboarding surfaces.
The next sprint should be repo stabilization, smoke verification, and focused vertical hardening — not broad new product expansion.
```

---

## Current Highest Risks

1. **Docker-backed smoke not yet green** — `pnpm smoke:phase1` needs Postgres, Redis, and API running.
2. **M0 E2E depth** — platform/school route denial, entitlement enforcement, SaaS billing lifecycle, and queue retry browser/API coverage need depth.
3. **Homework/Timetable stability** — recent PRs mention schema/service/test drift and Prisma generation concerns.
4. **Breadth without equal depth** — Phase 2/3 foundations exist, but not all are production-complete.
5. **Browser workflow coverage** — backend is ahead of authenticated Playwright coverage.
6. **Staging readiness** — pilot seed data, staging checks, backup/restore rehearsal, and observability still matter.
7. **Parent/mobile/driver/live tracking** — intentionally deferred and should not be accidentally treated as complete.

---

## Recommended Next Sprint

```text
Repo Verification + M0 Pilot Hardening Sprint
→ run full verification gate
→ run Docker-backed smoke with Postgres, Redis, and API running
→ add platform/school route denial browser tests
→ add SaaS billing lifecycle tests
→ add entitlement enforcement tests against real school APIs
→ deepen BullMQ failed-job inspection by deployed queue topology
→ stabilize Homework/Timetable if verification shows drift
→ wire Phase 2A Academics admin UI to completed APIs
→ prepare controlled pilot staging
```

Do not start Angular migration, AI, broad parent/mobile, live transport map, or new module expansion before this sprint is clean.

---

## Required Verification Gate

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
pnpm smoke:phase1
```

Run the full gate after every meaningful backend/module hardening change.

---

## Completion Time Estimate

Controlled pilot:

```text
2-4 weeks
```

Strong v1 production without AI:

```text
4-6 months solo
8-12 weeks with a focused 4-6 person team
```

Full SchoolOS vision including parent/mobile, live transport, enterprise SaaS, and AI:

```text
6-9 months solo from current state
4-6 months with a proper small team
```

These estimates assume the repo is stabilized first and future work proceeds one vertical at a time.
