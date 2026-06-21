# SchoolOS Next Phase Delivery Plan

**Status:** Canonical focused execution plan
**Created:** 2026-06-18
**Source audit:** `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`

This plan is dependency-driven. It does not replace the product requirements, functional requirements, architecture/security guide, design plans, or production runbook. It is the focused execution path for moving from local internal QA evidence to controlled pilot and then production readiness.

Cross-surface scope is governed by `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`. Its feature inventory is a boundary reference, not an automatic backlog: create implementation work only for repository-verified gaps that fit the current release phase and its exit gates.

## Current Verified Baseline

- Root local gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.
- Prisma generation and validation pass: `pnpm db:generate`, `pnpm db:validate`.
- OpenAPI wiring gate passes: `pnpm verify:openapi`.
- Web local production build passes and web contract tests pass.
- Playwright authenticated/browser smoke passes locally against the live seeded backend: `pnpm test:web:e2e` passed 17 checks on 2026-06-21.
- Flutter mobile gates pass: `flutter pub get`, `dart format --output=none --set-exit-if-changed .`, `flutter analyze`, `flutter test`, `flutter build apk --debug`.
- API has broad module, RBAC, entitlement, tenant isolation, File Registry, finance, payroll, learning, and mobile endpoint coverage in code and tests.
- 2026-06-21 Phase 1 local seed/smoke evidence passes with Docker Postgres/Redis and local API: `pnpm db:migrate`, `pnpm db:seed` twice, `pnpm smoke:pilot`, API typecheck/test/E2E, and Flutter analyze/test.
- 2026-06-21 Phase 3 local Android emulator role-flow QA passes for principal/admin, parent, class teacher, subject teacher, support staff, accountant, and driver against the same seeded backend, with narrow mobile fixes recorded in the audit.

## Current Blockers

1. Production env preflight fails when forced because required production variables/secrets are absent.
2. Staging migration/deploy/provider/storage/backup/restore evidence is missing.
3. Authenticated browser E2E and mobile role-flow QA have only local evidence; staging and physical-device evidence are missing.
4. External provider, object-storage, monitoring, rollback, and controlled-pilot evidence is missing.

## Production-Critical Gaps

- Authenticated browser E2E against staging once staging exists.
- Android emulator/physical-device role-flow QA against staging once staging exists.
- Staging `prisma migrate deploy`, seed, smoke, provider/storage readiness, backup, restore, and rollback evidence.
- Monitoring, queue health, logs, alert routing, and incident response verification.
- Keep the realistic default tenant seed and `pnpm smoke:pilot` repeatable as the browser/mobile/staging evidence expands.

## Stage-Aware Architecture Gaps

The formal BRD/PRD/FRS/SRS/SDD/MDD set defines SchoolOS as one shared platform with `PRESCHOOL`, `SCHOOL`, and `HIGHER_SECONDARY` experience packs. Current code evidence supports the shared tenant/student/guardian/enrollment/class/section/subject foundation, but these items remain design work, not implementation claims:

- Backend-owned `ExperienceContext`.
- Tenant program offerings and class/section stage profile.
- Preschool authorized pickup, temporary pickup change, arrival/checkout, pickup exception, and care-alert scope.
- Higher Secondary / +2 streams, subject combinations, practical/lab timetable, practical components, projects, and board-readiness lifecycle.

Do not build UI-only stage switches or hard-code +2 streams before schema, OpenAPI/shared DTO, authorization, web/mobile, migration, seed, and test requirements are designed.

## Stage-Aware Implementation Readiness Appendix

Stage-aware runtime implementation comes after the current GA blockers remain under control. Do not move new Preschool/+2 feature work ahead of Phase 1 seed, smoke, authenticated browser, mobile-device, staging, provider, storage, backup/restore, monitoring, and pilot evidence priorities.

Later runtime sequence:

1. Preserve Phase 1 seed/smoke/browser/mobile/staging priorities.
2. Design and approve program/stage schema and `ExperienceContext` contract.
3. Implement tenant program offerings and class/section stage profile.
4. Implement Preschool pickup/drop safety workflow.
5. Implement stage-aware Web compositions.
6. Implement stage-aware Flutter context switching.
7. Implement +2 streams, combinations, practicals, projects, and lab workflows.
8. Add role/tenant/stage scope tests before calling any stage experience complete.

Readiness rule: a stage experience is not complete until backend schema/contracts, OpenAPI/shared DTOs, web/mobile projections, tenant/RBAC/stage tests, protected-file behavior where relevant, seed coverage, browser/mobile QA, and staging evidence prove the workflow. Documentation alone does not establish implementation status.

## Explicitly Deferred Scope

- M14 Intelligence / AI.
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

**2026-06-21 local result:** `pnpm test:web:e2e` passed 17 checks against the live seeded local backend. This satisfies the local Phase 2 browser-E2E evidence target, but not the Phase 4 staging browser target.

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

**2026-06-21 local result:** The Android emulator checklist covered principal/admin, parent, class teacher, subject teacher, support staff, accountant, and driver against `http://10.0.2.2:4000/api/v1`. Subject-teacher attendance correctly denied while subject homework rendered assigned Mathematics items. This satisfies the local Phase 3 emulator evidence target, but not physical-device, signed release, or staging mobile evidence.

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

## Phase 7 - Deferred Expansion and M14 Intelligence/AI

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
- Separate M14 implementation plan approved after Phase 6 evidence.

## Immediate Next Phase

Phase 1 local seed/smoke evidence passed on 2026-06-21 after Phase 0 documentation cleanup: the seed is idempotent on local Postgres, representative role logins work, `pnpm smoke:pilot` passes with local Postgres/Redis/API, and parent/teacher/staff/driver API scope checks pass.

Phase 2 and Phase 3 local evidence also passed on 2026-06-21: authenticated browser E2E ran against the live seeded backend, and Android emulator role-flow QA covered representative parent, teacher, principal/admin, staff/accountant, and driver personas.

Next release action: start **Phase 4 - Staging Deployment, Provider Validation, Migration Safety, Backups, and Observability** with staging migration/deploy evidence, provider/storage readiness, backup/restore, monitoring/alerts, staging authenticated browser E2E, and staging mobile QA. Do not claim staging, controlled-pilot, release-candidate, or GA readiness until Phase 4+ evidence is recorded.
