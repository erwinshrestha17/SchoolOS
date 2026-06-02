# SchoolOS Remaining Implementation Plan

**Last updated:** 2026-06-02

**Status source:** `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` and `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`

**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

**Code-file modularization source:** `DEVELOPMENT_RULES.md`

This is the strict implementation order for SchoolOS from the current repo state. It records what is already implemented, what remains, and the phase gates future work must follow.

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue pilot hardening implemented; broader pilot hardening remains
M4 Academics: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library: Admin/backend foundation plus fine/accounting/staff-borrower depth implemented
M8B Transport: Admin/trip/location foundation plus GPS pressure/cache/retention depth implemented
M8C Canteen: Admin/wallet/POS/inventory foundation plus receipt/wallet-guard depth implemented
M9 Accounting: Completed / Pilot-Ready
M10 Communication/Chat: Foundation plus provider/attachment/retry depth implemented
SchoolOS Flutter mobile app: Started in apps/schoolos_mobile with scoped parent/student/teacher/staff/driver surfaces where available
M11 Intelligence/AI: Roadmap only
```

Current practical readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks, verify:production, and smoke verification in a local/staging environment that can bind browser-test ports
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Important working-tree note:

```text
M0 provider/queue/API-key pilot hardening and M10/M6/M7/M8A/M8C/M8B feature-depth hardening have been implemented and verified through build during sprint gates.
M0/File Registry storage hardening includes provider-neutral StorageAdapter, normalized local/s3/r2/minio/gcp config, private-by-default object writes, and short-lived signed URL helpers.
Admin web polish includes dashboard shell/card typography cleanup, accounting audit context, transport location freshness, scanner-first Library/Canteen QR flows, and app-controlled Toast/ConfirmDialog feedback.
pnpm verify:production must be rerun in local/staging if the current sandbox blocks browser E2E local-port binding.
pnpm smoke:phase1 still requires local Postgres, Redis, API, and web services.
```

Near-term rule:

```text
Do not start broad new modules.
Follow the phase gates below.
Stabilize and harden existing modules one vertical at a time.
Apply code-file modularization gradually in touched M0-M10 areas instead of doing one large repo-wide refactor.
```

Code-file modularization rule:

```text
This plan requires code-file modularization, not microservices.
When Codex works on any existing M0-M10 module or future module, it must check whether the touched service/controller/component/API-client file is too large or mixes unrelated responsibilities.
If yes, Codex should extract focused files only for the touched area while preserving behavior, routes, UI/UX, API contracts, tenant boundaries, database behavior, and tests.
Do not create a massive repo-wide modularization PR unless explicitly requested.
Use DEVELOPMENT_RULES.md as the source of truth.
```

Explicitly deferred until the plan allows it:

```text
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket/SSE UI
AI/ML features
Angular migration
Microservices
Biometric workflows
```

---

## 2. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong foundation | 90-95% |
| M0 Platform Core | Foundation complete with provider/queue pilot hardening; broader pilot hardening remains | 85-90% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR, storage/photo/logo, iEMIS, document audit, duplicate candidate review | 92-96% |
| M2 Smart Attendance | Pilot-ready plus correction/offline-draft, correction-review UI, and real-data Flutter teacher dashboard hardening | 93-97% |
| M3 Fees & Receipts | Pilot-ready plus focused finance hardening slice and Analysis export polish | 92-96% |
| M4 Academics / Exams / CAS / Report Cards | Completed / Pilot-Ready | 100% |
| M5 Activity Feed & Milestones | Strong foundation plus media privacy, optimized media variants, and teacher gallery hardening | 90-95% |
| M6 Homework & Timetable | Completed / Pilot-Ready | 100% |
| M7 HR & Payroll | Completed / Pilot-Ready | 100% |
| M8A Library Management | Admin/backend foundation plus fine-to-fees, QR lookup, reports, and export polish | 92-96% |
| M8B Transport Management | Admin/trip/location foundation plus GPS pressure/cache/retention depth and Flutter driver/parent surfaces | 91-95% |
| M8C Canteen Management | Admin/wallet/POS/inventory foundation plus idempotency, negative-balance guards, linked invoice handoff, and parent mobile views | 93-97% |
| M9 Accounting & Finance | Completed / Pilot-Ready | 100% |
| M10 Notices & Communication | Strong foundation with provider modes, attachments, failure dashboard, and parent mobile chat UI | 92-96% |
| M11 School Intelligence / AI | Roadmap only | 0% |

---

## 3. Strict Phase-Wise Implementation Plan

### Phase Gate 0 - Stabilize Main Before New Scope

Allowed work:

```text
verification fixes
migration fixes
seed fixes
tenant isolation fixes
permission fixes
doc alignment
small code-file modularization in touched areas
```

Blocked work:

```text
AI
Angular migration
microservices
broad new modules
deep mobile expansion without purpose-limited APIs and ownership tests
```

Exit criteria:

```text
1. Prisma generate and validate pass.
2. OpenAPI gate passes.
3. Lint, typecheck, unit tests, API E2E, web E2E, build, verify:production pass.
4. Local/staging smoke:phase1 runs with API, web, Postgres, and Redis.
5. Pending migrations are applied or intentionally parked with written reason.
6. Seed data supports every dashboard module route used in browser smoke.
7. No stale docs claim a module is next when it is already implemented.
```

### Phase 1 - Pilot Reliability for Existing Core

Scope:

```text
Auth/Security, M0, M1, M2, M3, M5, M10, settings, reports, file registry, notifications.
```

Focus:

```text
staging secrets/session review
storage readiness
request/correlation logging
notification provider failure visibility
export/report history
tenant isolation tests
platform denial tests
entitlement enforcement tests
permission-denied and slow-network browser states
```

### Phase 2 - High-Value Academic and Finance Polish

Scope:

```text
M4 Academics and M9 Accounting.
```

Remaining focus:

```text
staging object-storage/browser smoke verification
large-report threshold tuning
browser E2E execution in a local/staging environment that can bind local ports
```

### Phase 3 - Harden Homework/Timetable and HR/Payroll

Scope:

```text
M6 Homework/Timetable and M7 HR/Payroll.
```

Remaining focus:

```text
browser smoke execution in staging environment
mobile device smoke for teacher/staff flows
real-data QA for seeded assignments, payslips, attendance, and leave workflows
```

### Phase 4 - Harden Extended Operations Verticals

Scope:

```text
M8A Library, M8B Transport, M8C Canteen.
```

Remaining focus:

```text
Library barcode/QR scan QA
Transport driver device GPS runtime QA and background/automated location ping flow later
Canteen QR/POS speed polish
Inventory/vendor edge-case staging coverage
Operation-specific Playwright tests
```

### Phase 5 - Mobile Companion, Parent, Driver, and Live Experiences

Scope:

```text
Flutter parent/student/teacher/staff/driver/admin companion app depth.
```

Rules:

```text
Use purpose-limited APIs.
Do not reuse admin-shaped responses directly.
Add ownership tests before release.
Keep parent/student/driver data fail-closed.
```

### Phase 6 - M11 Intelligence / AI Readiness

Scope:

```text
Roadmap only until reliable production data exists.
```

Rules:

```text
No AI/ML runtime or LLM calls until explicitly approved.
No automated punishment/risk action.
Human review is mandatory for recommendations.
Tenant isolation and audit logging are mandatory.
```
