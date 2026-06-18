# SchoolOS Next Phase Delivery Plan

**Status:** Canonical focused execution plan  
**Created:** 2026-06-18  
**Source audit:** `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`  

This plan is dependency-driven. It does not replace the product requirements, functional requirements, architecture/security guide, design plans, or production runbook. It is the focused execution path for moving from local internal QA evidence to controlled pilot and then production readiness.

## Current Verified Baseline

- Root local gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.
- Prisma generation and validation pass: `pnpm db:generate`, `pnpm db:validate`.
- OpenAPI wiring gate passes: `pnpm verify:openapi`.
- Web local production build passes and web contract tests pass.
- Playwright public/browser-independent smoke passes, but authenticated checks skip.
- Flutter mobile gates pass: `flutter pub get`, `dart format --output=none --set-exit-if-changed .`, `flutter analyze`, `flutter test`, `flutter build apk --debug`.
- API has broad module, RBAC, entitlement, tenant isolation, File Registry, finance, payroll, learning, and mobile endpoint coverage in code and tests.

## Current Blockers

1. `pnpm smoke:pilot` fails without running Postgres, Redis, API, and seeded data.
2. Production env preflight fails when forced because required production variables/secrets are absent.
3. Authenticated Playwright browser checks skip.
4. Mobile role flows are not verified on Android emulator/device against a live seeded backend.
5. Staging migration/deploy/provider/storage/backup/restore evidence is missing.
6. Current demo seed work is dirty/uncommitted and was not proven idempotent in this audit.

## Production-Critical Gaps

- Realistic default tenant seed and role assignments for admin, principal, parent, class teacher, subject teacher, staff/accountant, and driver.
- Authenticated browser E2E against a live seeded backend.
- Android emulator role-flow QA against the same backend.
- Staging `prisma migrate deploy`, seed, smoke, provider/storage readiness, backup, restore, and rollback evidence.
- Monitoring, queue health, logs, alert routing, and incident response verification.

## Explicitly Deferred Scope

- M11 School Intelligence / AI.
- Broad student-owned mobile app beyond approved learning/session flows.
- Architecture rewrites, microservices, Kubernetes, search clusters, GPU workloads, or unrelated infrastructure.
- Production provider integrations without sandbox/staging credentials and verification.

## Phase 0 - Audit Cleanup and Stable Verification Baseline

**Goal:** Keep documentation honest and make the local verification baseline reproducible.

| Workstream | Required Work |
| --- | --- |
| Backend | Keep current local API gates passing. Avoid feature work except small fixes required to keep documented commands working. |
| Web | Keep contract tests and build passing. Clarify authenticated Playwright skip behavior. |
| Mobile | Keep Flutter analyze/tests/APK build passing. Record Android build warnings. |
| Test | Preserve the exact command list from the production audit. |
| Seed/demo data | Do not expand scope until current seed changes are reviewed and stabilized. |
| Staging/deploy | None beyond documenting missing gates. |

**Acceptance criteria:**
- `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` is current.
- `docs/README.md` points to this plan and the audit.
- No stale doc claims production readiness without proof.

**Exit gate:**
```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
cd apps/schoolos_mobile && flutter pub get && dart format --output=none --set-exit-if-changed . && flutter analyze && flutter test && flutter build apk --debug
```

## Phase 1 - Realistic Seeded Tenant, Role Assignment, and Smokeable Demo Flows

**Goal:** Make the default tenant usable for local demo, browser smoke, and mobile role testing without frontend hard-coded data.

| Workstream | Required Work |
| --- | --- |
| Backend | Complete central `apps/api/prisma/seed.ts` only; use existing models and services where lifecycle rules require them. Preserve tenant isolation, RBAC, File Registry, finance, and payroll boundaries. |
| Web | No broad UI rewrites. Fix only seed-dependent empty/error states uncovered by smoke. |
| Mobile | Ensure parent/teacher/staff/driver screens distinguish empty, permission, module-locked, and actual failure states. |
| Test | Add seed idempotency, parent own-child scope, teacher assigned-class/subject scope, staff own-record scope, driver assigned-trip scope, seeded mobile endpoint success, empty, unauthorized, and forbidden cases. |
| Seed/demo data | Seed one realistic Nepal school tenant with academic year, classes/sections, students/guardians, teacher assignments, timetable, attendance, homework, notices, fees/receipts, HR/payroll, and representative transport. |
| Staging/deploy | Local Docker services only. No production deployment. |

**Acceptance criteria:**
- Seed can run twice without duplicate core records.
- Representative parent, teacher, staff, principal, accountant, and driver accounts work.
- `pnpm smoke:pilot` passes with local Postgres/Redis/API.
- Mobile parent, teacher, staff, and driver endpoints return real data or valid empty responses.

**Exit gate:**
```bash
pnpm db:migrate
pnpm db:seed
pnpm smoke:pilot
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/api test:e2e
cd apps/schoolos_mobile && flutter analyze && flutter test
```

## Phase 2 - Authenticated Web Completion and Browser E2E for Pilot Workflows

**Goal:** Make web pilot workflows verifiable in a real browser against seeded backend data.

| Workstream | Required Work |
| --- | --- |
| Backend | Fix only endpoint defects discovered by browser E2E. |
| Web | Complete missing states and route-level flows for pilot-critical admissions, attendance, fees, student profile, homework/timetable, notices, HR/payroll, transport, and platform support override. |
| Mobile | No mobile expansion except contract fixes from shared APIs. |
| Test | Make authenticated Playwright tests run rather than skip. Add role-denial and module-locked browser checks. |
| Seed/demo data | Add only records required for browser E2E determinism. |
| Staging/deploy | Prepare staging env matrix but do not claim staging ready. |

**Acceptance criteria:**
- Browser tests cover school admin, platform operator, teacher, and restricted/denied routes.
- No browser E2E test silently skips because API or credentials are unavailable in the intended local QA path.
- Protected file flows open/download through authenticated helpers only.

**Exit gate:**
```bash
pnpm test:web:e2e
pnpm verify:production
```

The `verify:production` result is acceptable for this phase only if authenticated browser checks run and pass; public-only browser passes are insufficient.

## Phase 3 - Mobile Role Flows, Empty States, Device QA, and Real API Verification

**Goal:** Verify the companion app on Android emulator with real seeded backend data.

| Workstream | Required Work |
| --- | --- |
| Backend | Purpose-limited mobile endpoint fixes only. Preserve role-scoped APIs. |
| Web | No scope except docs and shared API contract updates. |
| Mobile | Finish parent, class teacher, subject teacher, principal, staff self-service, and driver flows. Ensure empty/error/locked/permission/offline states are meaningful and safe. |
| Test | Add repository/controller/widget tests for empty, permission denied, module locked, unauthorized, and seeded-data success cases. |
| Seed/demo data | Maintain representative mobile-ready accounts and records. |
| Staging/deploy | Produce Android debug QA evidence; release signing remains Phase 4. |

**Acceptance criteria:**
- Android emulator can log in as representative parent, class teacher, subject teacher, principal, staff/accountant, and driver.
- Parent sees only linked child data.
- Teacher sees only assigned classes/subjects.
- Staff sees only own attendance, leave, and payslips.
- Driver sees only assigned route/trip data.
- “Could not load” appears only for genuine request failures; retry appears only on actual errors.

**Exit gate:**
```bash
cd apps/schoolos_mobile
flutter pub get
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
flutter build apk --debug
```

Plus an Android emulator checklist with screenshots/log evidence for every representative role.

## Phase 4 - Staging Deployment, Provider Validation, Migration Safety, Backups, and Observability

**Goal:** Convert local readiness into controlled staging evidence.

| Workstream | Required Work |
| --- | --- |
| Backend | Run `prisma migrate deploy` on staging, verify `/health` and `/ready`, queue processors, provider readiness, and storage behavior. |
| Web | Deploy staging web with HTTPS API origin and authenticated browser E2E. |
| Mobile | Configure staging API URL and run emulator QA against staging. |
| Test | Run staging smoke, authenticated browser E2E, and mobile role checklist. |
| Seed/demo data | Seed staging demo tenant or pilot tenant according to data policy. |
| Staging/deploy | Validate secrets, HTTPS origins, storage, email/SMS/push modes, payment gateway sandbox, backups, restore, rollback, logs, and alerts. |

**Acceptance criteria:**
- `DEPLOY_ENV=production pnpm verify:env:deploy` equivalent passes for staging/production-like env values.
- Staging migration apply is recorded.
- Backup restore drill is recorded with duration and validation result.
- Provider readiness is documented as real, sandbox, disabled, or blocked.
- Alerts/log access are proven.

**Exit gate:**
```bash
pnpm verify:production
pnpm smoke:pilot
```

Plus staging-specific migration, backup, restore, provider, and alert verification records.

## Phase 5 - Controlled Single-School Pilot

**Goal:** Run one controlled pilot with real school workflows and explicit go/no-go criteria.

| Workstream | Required Work |
| --- | --- |
| Backend | Fix pilot-critical defects only; preserve auditability and data boundaries. |
| Web | Support daily school workflows and collect defect evidence. |
| Mobile | Support parent, teacher, staff, and driver companion flows selected for pilot. |
| Test | Run regression gates before each pilot release. |
| Seed/demo data | Move from demo seed to school-approved pilot data import/onboarding. |
| Staging/deploy | Operate backup, restore, rollback, monitoring, and incident response procedures. |

**Acceptance criteria:**
- One school completes agreed workflows for admissions/student profile, attendance, fees/receipts, homework/timetable, notices, staff self-service, and selected transport/mobile flows.
- No unresolved P0/P1 tenant isolation, finance, payroll, file, or auth defect remains.
- Backup/restore and rollback are understood by the operator team.

**Exit gate:**
- Pilot exit report with defects, resolutions, data corrections, support requests, and operator sign-off.

## Phase 6 - Multi-School Hardening and Production Release Readiness

**Goal:** Prove safe operation beyond a single controlled school.

| Workstream | Required Work |
| --- | --- |
| Backend | Strengthen tenant lifecycle, support override audits, queue/backfill operations, abuse protection, and migration rollback playbooks. |
| Web | Harden platform operations and tenant administration workflows. |
| Mobile | Add release signing, crash/analytics policy, and staged rollout checks. |
| Test | Add multi-tenant load, concurrency, migration replay, and incident drills where practical. |
| Seed/demo data | Maintain demo seed separately from real tenant onboarding scripts without creating a parallel schema. |
| Staging/deploy | Capacity, monitoring, backups, restore, rollback, and provider SLAs documented and tested. |

**Acceptance criteria:**
- Multi-tenant staging run proves support, monitoring, backup, restore, and rollback procedures across more than one tenant.
- Production release checklist has no open P0/P1 items.

**Exit gate:**
- Single-school production-ready decision can be upgraded only after pilot exit.
- Multi-school production-ready decision requires multi-tenant staging and operational proof.

## Phase 7 - Deferred Expansion and M11 Intelligence/AI

**Goal:** Reopen roadmap expansion only after production-critical gates are stable.

| Workstream | Required Work |
| --- | --- |
| Backend | Define privacy, consent, retention, model/provider, cost, and audit boundaries before any AI feature work. |
| Web | No AI UI until backend contracts and governance are approved. |
| Mobile | No AI/mobile learning expansion without explicit product approval. |
| Test | Add AI safety, prompt/data boundary, and provider failure tests only if AI is approved. |
| Seed/demo data | No synthetic AI claims in pilot data. |
| Staging/deploy | Provider governance and cost controls required before deployment. |

**Acceptance criteria:**
- Explicit product approval exists.
- Security/privacy review exists.
- Cost and provider failure modes are documented.

**Exit gate:**
- Separate M11 implementation plan approved after Phase 6 evidence.

## Immediate Next Phase

Start with **Phase 1 - Realistic Seeded Tenant, Role Assignment, and Smokeable Demo Flows** after Phase 0 documentation changes are merged. Phase 1 is the dependency for authenticated browser E2E, mobile role QA, and meaningful pilot smoke.

Phase 1 is complete only when the seed is idempotent, representative role logins work, `pnpm smoke:pilot` passes with local services, and parent/teacher/staff/driver mobile/API scope tests prove the role boundaries.
