# SchoolOS Project Status

**Status:** Current evidence-based project status snapshot  
**Last updated:** 2026-06-18  
**Product:** Nepal-first multi-tenant school operating SaaS with staged KG-12 direction  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, shared `@schoolos/core` contracts  

This document is the concise current status snapshot. It does not replace:

- `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` for readiness evidence, command results, scores, and blockers.
- `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` for the focused phase-wise execution path.
- `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` for longer module backlog and implementation history.

## Current Readiness Decision

| Readiness Level | Current State | Basis |
| --- | --- | --- |
| Demo-ready | Conditional | Local core gates pass, but `pnpm smoke:pilot` failed during the 2026-06-18 audit because local Postgres, Redis, and API were not running. Current demo seed work is also dirty/uncommitted and needs idempotency verification. |
| Internal QA-ready | Yes | Root lint/typecheck/test/E2E/build, API tests, web contract tests, web build, Flutter analyze/tests, and Android debug APK build passed locally. |
| Controlled pilot-ready | Conditional | Requires staging migration, provider/storage checks, authenticated browser E2E, mobile emulator role QA, backup restore drill, and pilot smoke. |
| Single-school production-ready | No | No executed staging deployment, production env validation, backup restore drill, signed mobile release, provider verification, or pilot exit evidence. |
| Multi-school production-ready | No | Multi-tenant operational readiness, capacity, monitoring, support override, backup/restore, rollback, and incident evidence are missing. |

Current audited scores:

```text
Product Implementation Completion Score: 74 / 100
Production Deployment Readiness Score: 50 / 100
Recommended target: Internal QA; demo-ready only after local services, seed, and smoke pass
```

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

- `pnpm test:web:e2e` passed with 5 public/browser-independent checks and 12 authenticated checks skipped.
- `pnpm verify:production` passed only as a local deploy gate. The production env preflight skipped because production env was unset.
- `DEPLOY_ENV=production pnpm verify:env:deploy` failed because required production secrets/origins were absent.
- `pnpm smoke:pilot` failed because Postgres, Redis, and the API were not running.
- No staging, provider, object storage, backup restore, signed release, or pilot workflow was verified.

## Current Implementation Snapshot

| Area | Current Status | Notes |
| --- | --- | --- |
| Repository and shared contracts | IMPLEMENTED_UNVERIFIED | Workspace scripts, `@schoolos/core`, Prisma compile artifacts, and boundary checks pass locally. |
| Backend/API | IMPLEMENTED_UNVERIFIED | Broad module implementation and tests exist across platform, admissions, attendance, finance, academics, activity, homework, HR/payroll, library, transport, canteen, accounting, communications, learning, mobile, File Registry, reports, usage, and settings. Production/staging evidence is missing. |
| Web | IMPLEMENTED_UNVERIFIED | Next.js routes, shared primitives, API helpers, cookie-first session metadata, contract tests, lint, typecheck, and build pass. Authenticated browser E2E still needs to run with live seeded backend. |
| Flutter mobile | PARTIALLY_IMPLEMENTED | Secure storage/session handling, role shell, parent/teacher/staff/driver repositories/screens, tests, analyze, and debug APK build pass. Emulator role-flow QA against live seeded backend is pending. |
| Seed/demo data | PARTIALLY_IMPLEMENTED | Central seed exists and is being expanded, but current seed changes are uncommitted and were not proven idempotent in this audit. |
| Staging/deployment | BLOCKED | No staging deployment, production env validation, provider/storage checks, backup restore, rollback, or monitoring proof. |
| M11 Intelligence/AI | DEFERRED | Roadmap only until production data quality, privacy, audit, and human-review foundations are proven. |

## Module Status Summary

Use the readiness statuses from the audit. Most modules are `IMPLEMENTED_UNVERIFIED` in backend/web because source and tests exist but staging, authenticated browser, provider, and pilot proof are absent.

| Module | Overall Status | Main Gap |
| --- | --- | --- |
| M0 Platform Core | IMPLEMENTED_UNVERIFIED | Staging/provider/queue/support-override operational proof. |
| M1 Admissions and Student Profiles | IMPLEMENTED_UNVERIFIED | Seeded browser flows and pilot data workflow proof. |
| M2 Smart Attendance | IMPLEMENTED_UNVERIFIED | Teacher/parent/mobile role QA and pilot smoke. |
| M3 Fees and Receipts | IMPLEMENTED_UNVERIFIED | Provider/payment sandbox and finance workflow smoke. |
| M4 Academics, Exams, CAS, Report Cards | IMPLEMENTED_UNVERIFIED | Browser/staging workflow proof and report-card file verification. |
| M5 Activity Feed and Milestones | IMPLEMENTED_UNVERIFIED | Media/provider/staging and mobile proof. |
| M6 Homework and Timetable | IMPLEMENTED_UNVERIFIED | Teacher/parent mobile and timetable smoke with realistic assignments. |
| M7 HR and Payroll | IMPLEMENTED_UNVERIFIED | Staff self-service mobile proof and payroll operational smoke. |
| M8A Library | IMPLEMENTED_UNVERIFIED | Browser/staging operational smoke. |
| M8B Transport | IMPLEMENTED_UNVERIFIED | Driver/route/trip mobile and staging proof. |
| M8C Canteen | IMPLEMENTED_UNVERIFIED | POS/wallet/parent mobile operational smoke. |
| M9 Accounting and Finance | IMPLEMENTED_UNVERIFIED | Staging export/queue/accounting close proof. |
| M10 Notices, Communication, Chat | IMPLEMENTED_UNVERIFIED | Provider callbacks, mobile notices/chat, and delivery smoke. |
| M11 Intelligence/AI | DEFERRED | Not approved for active implementation. |
| M12 Learning Layer | IMPLEMENTED_UNVERIFIED | Authenticated browser, lab/device, and staging proof. |

## Current Blockers

1. Complete and verify the realistic central seed for the default tenant.
2. Make `pnpm smoke:pilot` pass with local Docker services and seeded accounts.
3. Make authenticated Playwright checks run and pass rather than skip.
4. Run Android emulator role-flow QA against the seeded backend.
5. Run staging migration/deploy/provider/storage/backup/restore verification.
6. Resolve production environment requirements and document validated deployment values without committing secrets.

## Active Next Phase

The next development phase is:

```text
Phase 1 - Realistic Seeded Tenant, Role Assignment, and Smokeable Demo Flows
```

Source of truth: `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.

Exit criteria:

- Central seed is idempotent.
- Representative parent, class teacher, subject teacher, principal, staff/accountant, and driver accounts work.
- Parent, teacher, staff, and driver scope tests pass.
- `pnpm smoke:pilot` passes with local Postgres, Redis, API, and seeded data.
- Mobile role endpoints return real records or valid empty responses, not generic backend failures.
