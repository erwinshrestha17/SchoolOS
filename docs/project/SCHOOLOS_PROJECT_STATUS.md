# SchoolOS Project Status

**Status:** Current evidence-based project status snapshot
**Last updated:** 2026-06-30
**Product:** Nepal-first multi-tenant education operating SaaS with staged Preschool, School (Grade 1-10), Higher Secondary / +2, and Bachelor's direction. Master's is eligibility/future-extension only, not a full active management pack.
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, shared `@schoolos/core` contracts

This document is the concise current status snapshot. It does not replace:

- `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` for readiness evidence, command results, scores, and blockers.
- `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` for the focused phase-wise execution path.
- `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` for longer module backlog and implementation history.

Inventory & Asset Management is scrapped from the active SchoolOS module taxonomy. Do not treat prior M13 Inventory docs as active scope.

Bachelor's schema/API/UI/workflows are not currently verified as implemented. Any Bachelor's runtime claim needs schema, OpenAPI, shared-contract, RBAC/entitlement, tenant-isolation, student self-scope, seed, browser/mobile, and staging proof. Master's remains outside full management scope.

---

## Current Readiness Decision

| Readiness Level | Current State | Basis |
| --- | --- | --- |
| Demo-ready | Local-only | 2026-06-21 Phase 1-3 local evidence passed with Docker Postgres/Redis/API: seed idempotency, `pnpm smoke:pilot`, authenticated browser E2E, and Android emulator role-flow QA. This is not staging or pilot proof. |
| Internal QA-ready | Yes | Root lint/typecheck/test/E2E/build, API tests, web contract tests, web build, authenticated browser E2E, Flutter analyze/tests, Android debug APK build, and Android emulator role-flow QA passed locally. |
| Controlled pilot-ready | Conditional | Requires staging migration, provider/storage checks, staging browser/mobile QA, backup restore drill, monitoring/rollback proof, and pilot smoke. |
| Single-school production-ready | No | No executed staging deployment, production env validation, backup restore drill, signed mobile release, provider verification, or pilot exit evidence. |
| Multi-school production-ready | No | Multi-tenant operational readiness, capacity, monitoring, support override, backup/restore, rollback, and incident evidence are missing. |

Current audited scores:

```text
Product Implementation Completion Score: 80 / 100
Production Deployment Readiness Score: 56 / 100
Recommended target: Internal QA; local demo smokeable, but not staging, controlled-pilot, release-candidate, or GA ready
```

---

## Current Verified Baseline

The 2026-06-18 audit verified these local gates:

```text
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/api test:e2e
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web lint
pnpm --filter @schoolos/web build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:web:e2e
pnpm verify:production
cd apps/schoolos_mobile && flutter pub get
cd apps/schoolos_mobile && dart format --output=none --set-exit-if-changed .
cd apps/schoolos_mobile && flutter analyze
cd apps/schoolos_mobile && flutter test
cd apps/schoolos_mobile && flutter build apk --debug
```

Important caveats:

- The original `pnpm test:web:e2e` audit passed with 5 public/browser-independent checks and 12 authenticated checks skipped; the later 2026-06-21 local seeded run passed 17 checks with authenticated coverage running.
- `pnpm verify:production` passed only as a local deploy gate. The production env preflight skipped because production env was unset.
- `DEPLOY_ENV=production pnpm verify:env:deploy` failed because required production secrets/origins were absent.
- No staging, provider, object storage, backup restore, signed release, or pilot workflow was verified.

2026-06-21 Phase 1 local update:

- `pnpm db:migrate` passed on local Docker Postgres with no pending migrations.
- `pnpm db:seed` passed twice on the same local database after staff seed idempotency was fixed.
- `pnpm smoke:pilot` passed against local Postgres, Redis, API, and seeded data.
- `pnpm --filter @schoolos/api typecheck`, `pnpm --filter @schoolos/api test`, and `pnpm --filter @schoolos/api test:e2e` passed.
- `cd apps/schoolos_mobile && flutter analyze && flutter test` passed after narrow test/lint fixes.

2026-06-21 Phase 2/3 local update:

- `pnpm test:web:e2e` passed 17 authenticated/public Playwright checks against the live seeded local API.
- Android emulator QA ran on `Pixel_10_Pro` / `emulator-5554` against `http://10.0.2.2:4000/api/v1`.
- Principal/admin, parent, class-teacher, subject-teacher, support-staff, accountant, and driver role flows rendered expected local seeded states after narrow mobile fixes.

---

## Current Implementation Snapshot

| Area | Current Status | Notes |
| --- | --- | --- |
| Repository and shared contracts | IMPLEMENTED_UNVERIFIED | Workspace scripts, `@schoolos/core`, Prisma compile artifacts, and boundary checks pass locally. |
| Backend/API | IMPLEMENTED_UNVERIFIED | Broad module implementation and tests exist across platform, admissions, attendance, finance, academics, activity, homework, HR/payroll, library, transport, canteen, accounting, communications, learning, mobile, File Registry, reports, usage, and settings. Production/staging evidence is missing. |
| Web | LOCALLY_VERIFIED | Next.js routes, shared primitives, API helpers, cookie-first session metadata, contract tests, lint, typecheck, build, and authenticated browser E2E pass locally. Staging browser proof is missing. |
| Flutter mobile | LOCALLY_VERIFIED | Secure storage/session handling, role shell, parent/teacher/staff/driver repositories/screens, tests, analyze, debug APK build, and Android emulator role-flow QA pass locally. Physical-device/staging proof is missing. |
| Seed/demo data | LOCALLY_VERIFIED | Central seed is idempotent on local Postgres and `pnpm smoke:pilot` passes with representative role logins and scope checks. Staging seed proof is still missing. |
| Staging/deployment | BLOCKED | No staging deployment, production env validation, provider/storage checks, backup restore, rollback, or monitoring proof. |
| M12 Notifications / Communication | IMPLEMENTED_UNVERIFIED | Architecture and broad communication surfaces exist, but provider callbacks, mobile notices/chat, delivery retry, read state, queue, and staging proof remain gaps. |
| M13 Learning Layer | IMPLEMENTED_UNVERIFIED | Implemented foundation exists; authenticated browser, lab/device, and staging proof remain gaps. |
| M14 Intelligence/AI | DEFERRED | Roadmap only until production data quality, privacy, audit, and human-review foundations are proven. |

---

## Module Status Summary

Use the readiness statuses from the audit. Most modules are `IMPLEMENTED_UNVERIFIED` in backend/web because source and tests exist but staging, authenticated browser, provider, and pilot proof are absent.

| Module | Overall Status | Main Gap |
| --- | --- | --- |
| M0 Platform Core | IMPLEMENTED_UNVERIFIED | Staging/provider/queue/support-override operational proof. |
| M1 Admissions and Student Profiles | IMPLEMENTED_UNVERIFIED | Unified Admission Case direct/review flow is locally implemented; seeded authenticated browser, protected-document, mobile snapshot, staging, and pilot workflow proof remain. |
| M2 Smart Attendance | IMPLEMENTED_UNVERIFIED | Local teacher/parent mobile evidence exists; staging and pilot smoke remain. |
| M3 Fees and Receipts | IMPLEMENTED_UNVERIFIED | Provider/payment sandbox and finance workflow smoke. |
| M4 Academics, Exams, CAS, Report Cards | IMPLEMENTED_UNVERIFIED | Browser/staging workflow proof and report-card file verification. |
| M5 Activity Feed and Milestones | IMPLEMENTED_UNVERIFIED | Media/provider/staging and mobile proof. |
| M6 Homework and Timetable | IMPLEMENTED_UNVERIFIED | Local teacher homework evidence exists; timetable staging/pilot smoke remains. |
| M7 HR and Payroll | IMPLEMENTED_UNVERIFIED | Local staff/accountant self-service mobile proof exists; payroll operational smoke remains. |
| M8 Library | IMPLEMENTED_UNVERIFIED | Browser/staging operational smoke. |
| M9 Transport | IMPLEMENTED_UNVERIFIED | Local driver/route/trip mobile proof exists; staging proof remains. |
| M10 Canteen | IMPLEMENTED_UNVERIFIED | POS/wallet/parent mobile operational smoke. |
| M11 Accounting and Finance | IMPLEMENTED_UNVERIFIED | Staging export/queue/accounting close proof. |
| M12 Notifications, Notices, Communication, Chat | IMPLEMENTED_UNVERIFIED | Provider callbacks, mobile notices/chat, delivery retries, read state, and delivery smoke. |
| M13 Learning Layer | IMPLEMENTED_UNVERIFIED | Authenticated browser, lab/device, and staging proof. |
| M14 Intelligence/AI | DEFERRED | Not approved for active implementation. |

---

## Current Blockers

1. Run staging migration/deploy/provider/storage/backup/restore verification. The staging env preflight command path now exists, but no staging values or deployed environment have been verified.
2. Run staging authenticated browser E2E and staging mobile role-flow QA once staging exists.
3. Add physical-device and signed mobile release evidence before release-candidate claims.
4. Resolve production environment requirements and document validated deployment values without committing secrets.
5. Prove M12 notification provider callbacks, delivery retries, mobile notification center, read state, and delivery smoke before production-readiness claims.
6. Keep the local seed and `pnpm smoke:pilot` repeatable as browser/mobile/staging fixtures evolve.

---

## Active Next Phase

The next development phase is:

```text
Phase 4 - Staging Deployment, Provider Validation, Migration Safety, Backups, and Observability
```

Source of truth: `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.

Entry criteria already met locally:

- Central seed is idempotent on local Postgres.
- Representative parent, class teacher, subject teacher, principal, support staff/accountant, and driver accounts work locally.
- Parent, teacher, staff, and driver scope checks pass locally.
- `pnpm smoke:pilot` and `pnpm test:web:e2e` pass with local Postgres, Redis, API, and seeded data.
- Android emulator role-flow QA returns real records or valid permission/empty responses, not generic backend failures.

2026-06-30 Phase 4 tooling update:

- `pnpm verify:env:staging` and `pnpm verify:env:production` run the strict deploy env preflight with `NODE_ENV=production`.
- The preflight checks HTTPS origins, web API base URL, non-placeholder secrets, production runtime opt-in, provider mode consistency, and storage-specific required values.
- The preflight can load an untracked staging env file through `DEPLOY_ENV_FILE` / `SCHOOLOS_DEPLOY_ENV_FILE`; no real staging values have been supplied or verified yet.
- `apps/web/.env.example` now documents the required web API base URL. This is tooling support only; staging remains unverified until the deployed checks pass.
