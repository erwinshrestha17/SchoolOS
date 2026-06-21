# SchoolOS Production Readiness Audit

**Status:** Canonical evidence-based audit
**Audit date:** 2026-06-18
**Branch audited:** `main`
**Commit audited:** `edeef795ecd16b02ab046a4b45a4c68503ab6bfc`
**Current target recommendation:** Internal QA, with local seed/smoke, authenticated browser, and Android emulator evidence; not staging, pilot, release-candidate, or GA ready

This audit treats repository code, tests, CI, scripts, schema, migrations, deployment/runbook files, and commands run on 2026-06-18 as evidence. Documentation claims are not treated as proof by themselves.

## Evidence Limitations

- The worktree was dirty before this audit: `apps/api/prisma/seed.ts` was modified and `apps/api/prisma/seed.canonical.spec.ts` was untracked.
- No staging environment, provider sandbox, object storage bucket, payment gateway, SMS, email, FCM, backup restore drill, or real pilot tenant was verified during this audit.
- `pnpm verify:production` is a local deployment gate. In this shell, its production environment preflight skipped unless `DEPLOY_ENV=production` was forced.
- The original browser E2E audit completed with 12 authenticated browser tests skipped; a later 2026-06-21 local seeded backend run made those tests run and pass.
- In the original 2026-06-18 audit, `pnpm smoke:pilot` failed because Postgres, Redis, and the API were not running.
- The original mobile audit covered Flutter analyze/tests and Android debug APK build. A later 2026-06-21 Android emulator walkthrough covered representative local seeded roles, but not physical-device or staging mobile QA.
- The 2026-06-21 local updates below do not include staging deployment, provider/storage sandbox checks, backup restore, rollback, monitoring, signed mobile release, physical-device QA, or real pilot evidence.

## 2026-06-21 Phase 1 Local Evidence Update

After the original 2026-06-18 audit, Phase 1 seed/smoke work resumed against local Docker Postgres/Redis and the local NestJS API.

| Command | Result | Evidence |
| --- | --- | --- |
| `docker compose ps` | PASS after Docker Desktop startup | Existing `schoolos_postgres` and `schoolos_redis` containers became healthy. Initial check failed while the Docker daemon was not running. |
| `pnpm db:migrate` | PASS | Prisma found 35 migrations and no pending migrations on local Postgres. |
| `pnpm db:seed` | FAIL before fix | Existing local staff rows using old `EMP-DEMO-*` employee IDs collided on unique `Staff.userId`. |
| `pnpm db:seed` | PASS twice after fix | Seed proved idempotent on the same local database after staff profile upsert was keyed by existing `userId` before canonical employee ID creation. |
| `pnpm smoke:pilot` | PASS after fix | Postgres, Redis, `/health`, `/ready`, seeded admin/principal/parent/class-teacher/subject-teacher/staff/accountant/driver logins, parent own-child scope, teacher assigned-scope checks, principal/staff/accountant/driver checks, and non-parent mobile fail-closed behavior passed. |
| `pnpm --filter @schoolos/api typecheck` | PASS | API TypeScript passed after core build and Prisma generation. |
| `node --check scripts/smoke-runner-local.mjs` | PASS | Smoke runner syntax is valid. |
| `pnpm --filter @schoolos/api test` | PASS | 163 suites, 1283 tests passed. |
| `pnpm --filter @schoolos/api test:e2e` | PASS | 40 suites, 241 tests passed. |
| `cd apps/schoolos_mobile && dart format ... && flutter analyze && flutter test` | PASS | Touched Dart files formatted, Flutter analyze reported no issues, and 73 tests passed. |

## 2026-06-21 Phase 2/3 Local Evidence Update

Phase 2 authenticated web E2E and Phase 3 emulator role-flow QA ran against the same local seeded backend. This is stronger local QA evidence, but it is still not staging, pilot, release-candidate, or GA evidence.

| Command / Check | Result | Evidence |
| --- | --- | --- |
| `pnpm test:web:e2e` | PASS | 17 authenticated/public Playwright checks passed in 44.9s against local API `http://localhost:4000/api/v1` and seeded credentials. Authenticated browser checks no longer skipped in this local path. |
| Android emulator boot | PASS | `Pixel_10_Pro` AVD booted as `emulator-5554`; `adb shell getprop sys.boot_completed` returned `1`; Flutter saw `sdk gphone16k arm64`. |
| `flutter run -d emulator-5554 --dart-define=SCHOOL_OS_API_BASE_URL=http://10.0.2.2:4000/api/v1` | PASS | Debug APK built, installed, and launched against the live local NestJS API. Flutter doctor still reports Android cmdline-tools/license warnings; they did not block this debug run. |
| Principal/admin role flow | PASS after fix | Principal login showed Today, attention cards, and Approvals. A blank Approvals screen from an infinite-width `OutlinedButton` was fixed and retested. |
| Parent role flow | PASS | Parent login showed the family snapshot and one linked child only; Children tab showed the scoped child card with homework/update/fees state. |
| Class-teacher role flow | PASS after fix | Class teacher login showed Today; Attendance initially blanked from an infinite-width `OutlinedButton`, then rendered Class 1-A, 28 students, and status actions after the fix. Homework rendered an honest empty/unavailable teaching-scope state. |
| Subject-teacher role flow | PASS with scoped denial | Subject teacher login entered the teacher shell. Today/Attendance denied with a clean permission state; Homework rendered Mathematics assignments for assigned subject scopes. |
| Staff and accountant role flows | PASS after fix | `support_staff` was mapped to the staff shell. Staff and accountant logins showed own attendance, leave, and payslip summaries; attendance and payslip tabs rendered backend data. |
| Driver role flow | PASS | Driver login showed live trip, route, vehicle, assignment counts, active route, and student manifest for the assigned route only. |
| Settings logout path | PASS after fix | Logout `ListTile` debug Material assertion was fixed by wrapping the tile in its own transparent `Material`; no fresh assertion appeared on the spot-check. |

## Commands Actually Run

| Command | Result | Evidence |
| --- | --- | --- |
| `git status --short` | PASS with dirty worktree | Pre-existing seed changes: `M apps/api/prisma/seed.ts`, `?? apps/api/prisma/seed.canonical.spec.ts`. |
| `pnpm db:generate` | PASS | Prisma schema and core generated artifacts compiled; Prisma Client generated. |
| `pnpm db:validate` | PASS | `apps/api/prisma/schema.prisma` valid. |
| `pnpm verify:openapi` | PASS | OpenAPI wiring gate passed. |
| `pnpm --filter @schoolos/api typecheck` | PASS | API TypeScript passed after core build and Prisma generation. |
| `pnpm --filter @schoolos/web typecheck` | PASS | Web TypeScript passed. |
| `pnpm --filter @schoolos/api test` | PASS | 149 suites, 1199 tests passed. Negative-path logs were expected by tests. |
| `pnpm --filter @schoolos/api test:e2e` | PASS | 40 suites, 239 tests passed. |
| `pnpm --filter @schoolos/web test` | PASS | 12 suites, 166 tests passed. |
| `pnpm --filter @schoolos/web lint` | PASS | ESLint passed with zero warnings. |
| `pnpm --filter @schoolos/web build` | PASS | Next.js production build generated 154 static pages plus dynamic routes. |
| `pnpm typecheck` | PASS | Root aggregate typecheck and core boundary checks passed. |
| `pnpm lint` | PASS | Root aggregate lint/format checks passed. |
| `pnpm test` | PASS | Root aggregate API and web tests passed. |
| `pnpm build` | PASS | Root aggregate core, API, and web build passed. |
| `pnpm test:web:e2e` | PASS with skips | 5 passed, 12 skipped. Authenticated browser coverage did not run. |
| `pnpm verify:production` | PASS with caveats | Rerun outside sandbox after `listen EPERM`; local deploy gate passed, production env preflight skipped, web E2E still 5 passed / 12 skipped. |
| `pnpm smoke:pilot` | FAIL | Postgres, Redis, `/health`, `/ready`, and seeded admin login all failed because local services were not running. |
| `DEPLOY_ENV=production pnpm verify:env:deploy` | FAIL as expected | Required production env values/secrets were absent. |
| `flutter pub get` | PASS after escalation | Flutter SDK cache write required permission outside repository. |
| `dart format --output=none --set-exit-if-changed .` | PASS | 127 files checked, 0 changed. |
| `flutter analyze` | PASS | No issues found. |
| `flutter test` | PASS | All Flutter tests passed. |
| `flutter build apk --debug` | PASS after escalation | Built `build/app/outputs/flutter-apk/app-debug.apk`; plugin KGP deprecation warning remains. |

## Readiness Scores

### Product Implementation Completion: 80 / 100

| Rubric Area | Weight | Score | Evidence |
| --- | ---: | ---: | --- |
| Backend/API implementation | 30 | 25 | Broad NestJS modules/controllers, RBAC/entitlement guards, 149 unit suites and 40 API E2E suites passed locally. |
| Web frontend implementation | 25 | 21 | Next.js build, lint, typecheck, and 166 web contract tests passed; 2026-06-21 local authenticated browser E2E passed against seeded backend. Staging browser evidence is still missing. |
| Mobile implementation | 15 | 11 | Flutter role shell, parent/teacher/staff/driver repositories and tests exist; analyze/tests/APK build passed; 2026-06-21 Android emulator role-flow QA passed for representative seeded personas. Physical-device/staging evidence is missing. |
| Data model, migrations, seed, workflows | 15 | 11 | Prisma schema validates and migrations exist. 2026-06-21 local migrate/seed replay passed and seed ran twice; staging migration replay not run. |
| Automated verification coverage | 15 | 12 | Strong local unit/E2E/contract gates; 2026-06-21 local pilot smoke and authenticated browser E2E passed. No coverage report, staging, physical-device, or pilot evidence exists. |

### Production Deployment Readiness: 56 / 100

| Rubric Area | Weight | Score | Evidence |
| --- | ---: | ---: | --- |
| Build, typecheck, lint, automated tests | 20 | 17 | Root lint/typecheck/test/build and local deploy gate passed. |
| Security, RBAC, tenant isolation, data protection | 20 | 15 | Guards, entitlement checks, safe errors, File Registry patterns, many security tests, and local seeded role/browser/emulator checks exist; staging/pilot proof is missing. |
| DB migration, backup, restore, rollback readiness | 15 | 7 | Migrations and runbook exist; no restore drill or staging migration apply was executed during this audit. |
| Staging deployment and environment validation | 15 | 2 | Production env preflight fails without required secrets; no staging deployment evidence. |
| Browser/device E2E and pilot verification | 15 | 10 | Local authenticated browser E2E and Android emulator role-flow QA passed on 2026-06-21. Staging browser/device, physical-device, and pilot evidence are missing. |
| Monitoring, logs, queues, alerts, runbook readiness | 15 | 5 | Health/queue/platform surfaces and runbook exist; no deployed monitoring/alerting proof. |

## Readiness Levels

| Level | Current State | Missing Gates | Proof Required |
| --- | --- | --- | --- |
| Demo-ready | Local-only | Local DB/Redis/API seed, `pnpm smoke:pilot`, authenticated browser E2E, and Android emulator role-flow QA passed on 2026-06-21. | Keep local smoke repeatable; staging and pilot proof still require later gates. |
| Internal QA-ready | Yes | QA must accept local-only evidence. | Root gates, API E2E, web contract tests, authenticated browser E2E, Flutter analyze/tests/APK build, and Android emulator role-flow QA. |
| Controlled pilot-ready | Conditional | Staging migration, provider/storage checks, backup restore drill, physical-device/signed mobile release path, monitoring, rollback, and pilot workflow proof. | Passing staging smoke and documented pilot checklist with real seeded school flows. |
| Single-school production-ready | No | Production env/secrets, backup/restore, monitoring, provider validation, signed mobile release, rollback rehearsal. | Reproducible production deployment dry run and one controlled pilot exit report. |
| Multi-school production-ready | No | Multi-tenant operational runbooks, support override drills, capacity/queue monitoring, tenant lifecycle proof, incident response evidence. | Multi-tenant staging/pilot evidence and rollback/recovery drills across tenants. |

## Repository Readiness

| Area | Status | Evidence |
| --- | --- | --- |
| Monorepo structure | VERIFIED_COMPLETE | `pnpm-workspace.yaml` covers `apps/*` and `packages/*`; root scripts coordinate core/api/web gates. |
| Shared packages | IMPLEMENTED_UNVERIFIED | `@schoolos/core` builds and boundary checks pass; no standalone package tests beyond aggregate compile/typecheck evidence. |
| Environment handling | PARTIALLY_IMPLEMENTED | API `.env.example` exists and production preflight exists; no committed web env example; production preflight fails when forced without secrets. |
| Docker/local development | PARTIALLY_IMPLEMENTED | `docker-compose.yml` provisions Postgres and Redis only; app process orchestration remains script/manual. |
| CI/CD | PARTIALLY_IMPLEMENTED | GitHub Actions runs deploy core and conditional web E2E with Redis service; no Postgres service or deployment workflow evidence. |
| Deployment/rollback | PARTIALLY_IMPLEMENTED | Runbook has deployment, backup, restore, and rollback procedures; no executed staging/restore proof. |
| Secret handling | PARTIALLY_IMPLEMENTED | Env examples avoid real secrets and production preflight requires strong secrets; local `.env` files are untracked and were not audited. |

## API Readiness

| Area | Status | Evidence |
| --- | --- | --- |
| NestJS module coverage | IMPLEMENTED_UNVERIFIED | Modules exist for platform, admissions, attendance, finance, academics, activity, homework, HR/payroll, library, transport, canteen, accounting, communications, learning, mobile, file registry, reports, usage, settings. |
| Controllers/routes | IMPLEMENTED_UNVERIFIED | Broad controller surface under `apps/api/src/**`; OpenAPI wiring gate passed. |
| RBAC and permissions | IMPLEMENTED_UNVERIFIED | `RolesPermissionsGuard`, permission aliases, controller decorators, and role/permission tests exist. |
| Tenant isolation | IMPLEMENTED_UNVERIFIED | Tenant-scoped services and tenant-isolation E2E tests exist; full pilot data cross-scope checks not run. |
| Module entitlement | IMPLEMENTED_UNVERIFIED | `EntitlementGuard`, `@RequiredModule`, feature checks, and module lock tests exist. |
| Auth/session/cookies/JWT | IMPLEMENTED_UNVERIFIED | Auth service/guards/tests exist; local tests pass. Production cookie/domain behavior not staged. |
| Input validation | IMPLEMENTED_UNVERIFIED | Global `ValidationPipe` with whitelist/forbid non-whitelisted; DTO tests exist. |
| Safe errors | IMPLEMENTED_UNVERIFIED | `HttpExceptionFilter` returns bounded envelopes and masks 500 internals; tests pass. |
| Prisma schema/migrations | IMPLEMENTED_UNVERIFIED | Schema validates; migrations exist. No fresh staging migration replay or restore drill in this audit. |
| Seed behavior | LOCALLY_VERIFIED | Central seed ran twice on local Postgres on 2026-06-21 after staff `userId` idempotency fix; staging seed proof is still missing. |
| Accounting/payroll boundaries | IMPLEMENTED_UNVERIFIED | Unit/E2E tests cover reversals/posting/salary slip flows; no live finance/payroll workflow smoke. |
| Queue/Redis/BullMQ | PARTIALLY_IMPLEMENTED | BullMQ configured and queue tests exist; 2026-06-21 local smoke verified Redis connectivity. Staging queue proof is missing. |
| File Registry/storage | IMPLEMENTED_UNVERIFIED | File Registry controllers/services/tests and protected-download patterns exist; no external object storage verification. |
| Provider integrations/webhooks | PARTIALLY_IMPLEMENTED | Webhook and provider readiness code/tests exist; real provider sandbox verification is absent. |
| Health/readiness | LOCALLY_VERIFIED | 2026-06-21 local smoke verified `/health` and `/ready`; staging health/readiness proof is missing. |
| Audit logging | IMPLEMENTED_UNVERIFIED | Audit module and platform audit surfaces exist; no deployed retention/logging proof. |

## Web Readiness

| Area | Status | Evidence |
| --- | --- | --- |
| Next.js build health | VERIFIED_COMPLETE | `pnpm --filter @schoolos/web build` and root build passed. |
| Auth/protected routes | LOCALLY_VERIFIED | Cookie-first session metadata and permission checks exist; 2026-06-21 authenticated browser E2E passed locally against the seeded backend. Staging evidence is missing. |
| Permission-aware navigation | IMPLEMENTED_UNVERIFIED | Web contract tests assert navigation/permission gates; live role walkthrough missing. |
| Module entitlement states | IMPLEMENTED_UNVERIFIED | Design and contracts cover locked states; browser coverage incomplete. |
| Loading/empty/error/locked states | IMPLEMENTED_UNVERIFIED | Shared primitives and many contract checks exist; not every screen was manually audited in-browser. |
| Protected file handling | IMPLEMENTED_UNVERIFIED | Authenticated file helper patterns and tests exist; external storage not verified. |
| Accessibility/responsive | PARTIALLY_IMPLEMENTED | Keyboard/route smoke specs exist; no full accessibility audit. |
| Browser E2E | LOCALLY_VERIFIED | 17 Playwright checks passed locally against the live seeded backend on 2026-06-21. Staging browser evidence is missing. |
| API contract consistency | IMPLEMENTED_UNVERIFIED | Web imports `@schoolos/core`, contract tests pass. |
| Client security | IMPLEMENTED_UNVERIFIED | Browser stores metadata only, uses cookie credentials, validates PDF responses; full manual security review not complete. |

## Mobile Readiness

| Area | Status | Evidence |
| --- | --- | --- |
| Startup/config | LOCALLY_VERIFIED | Flutter tests pass; Android debug APK builds; 2026-06-21 `Pixel_10_Pro` Android emulator launched against `http://10.0.2.2:4000/api/v1`. Physical-device/staging proof is missing. |
| API base URL | IMPLEMENTED_UNVERIFIED | Android emulator default is `http://10.0.2.2:4000/api/v1`; override supports `SCHOOL_OS_API_BASE_URL`. |
| Secure storage/session | IMPLEMENTED_UNVERIFIED | Secure storage, token refresh, expired-token tests pass. |
| Role navigation | LOCALLY_VERIFIED | Representative parent, class teacher, subject teacher, principal/admin, support staff, accountant, and driver logins routed to the expected local emulator shells on 2026-06-21. |
| Parent flows | LOCALLY_VERIFIED | Parent emulator QA showed only linked-child family data for the seeded guardian. Staging/physical-device proof is missing. |
| Teacher flows | LOCALLY_VERIFIED | Class-teacher attendance and subject-teacher homework rendered seeded scoped data; subject-teacher attendance denied cleanly. Broader timetable/message proof remains limited. |
| Principal flows | LOCALLY_VERIFIED | Principal Today and Approvals rendered after a narrow layout fix. Staging/physical-device proof is missing. |
| Staff self-service | LOCALLY_VERIFIED | Support staff and accountant emulator QA showed own attendance, leave, and payslip summaries; staff attendance and payslip tabs rendered backend data. |
| Driver/transport | LOCALLY_VERIFIED | Driver emulator QA showed assigned live trip, route, vehicle, assignments, and student manifest. |
| Notices/chat | PARTIALLY_IMPLEMENTED | Notices repository tests exist; chat/device notification proof missing. |
| Empty/error/offline states | PARTIALLY_IMPLEMENTED | Shared state widgets exist; several screens still use generic “Could not load …” for actual request errors. |
| Release readiness | BLOCKED | Debug APK builds; release signing/configuration and store/release workflow not verified. |

## Module Readiness Matrix

| Module | Backend | Web | Mobile | Tests | Deployment |
| --- | --- | --- | --- | --- | --- |
| M0 Platform Core | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | DEFERRED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M1 Admissions and Student Profiles | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M2 Smart Attendance | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M3 Fees and Receipts | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M4 Academics, Exams, CAS, Report Cards | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M5 Activity Feed and Milestones | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M6 Homework and Timetable | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M7 HR and Payroll | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M8 Library | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | DEFERRED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M9 Transport | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M10 Canteen | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M11 Accounting and Finance | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | DEFERRED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M12 Notifications, Notices, Communication, Chat | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M13 Learning Layer | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| M14 Intelligence / AI | DEFERRED | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| Public marketing/demo intake | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | DEFERRED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| Platform admin and tenant administration | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | DEFERRED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| File Registry/protected documents | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |
| Multi-tenant isolation and lifecycle | IMPLEMENTED_UNVERIFIED | IMPLEMENTED_UNVERIFIED | PARTIALLY_IMPLEMENTED | IMPLEMENTED_UNVERIFIED | BLOCKED |

Deployment is `BLOCKED` across modules because no staging deployment, production env validation, provider validation, restore drill, or pilot smoke passed during this audit.

## Documentation Inventory and Consolidation Decisions

The full current tracked Markdown inventory is now owned by `docs/project/SCHOOLOS_DOCUMENTATION_INVENTORY.md`. The table below is retained as the 2026-06-18 audit snapshot and should not be treated as the complete current inventory after the 2026-06-20 documentation consolidation pass.

| Markdown File | Decision | Notes |
| --- | --- | --- |
| `README.md` | UPDATE | Root orientation; link to this audit and next-phase plan. |
| `AGENTS.md` | KEEP_AS_CANONICAL | Repository rules for agents. |
| `apps/api/AGENTS.md` | KEEP_AS_CANONICAL | API-specific rules. |
| `apps/web/AGENTS.md` | KEEP_AS_CANONICAL | Web-specific rules. |
| `apps/schoolos_mobile/AGENTS.md` | KEEP_AS_CANONICAL | Mobile-specific rules. |
| `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` | KEEP_AS_CANONICAL | App-local mobile guide pointing to canonical mobile plan. |
| `apps/schoolos_mobile/docs/DESIGN_SYSTEM.md` | KEEP_AS_CANONICAL | Mobile app design system. |
| `apps/schoolos_mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` | KEEP_AS_CANONICAL | Flutter asset placeholder. |
| `apps/web/docs/DESIGN_SYSTEM.md` | KEEP_AS_CANONICAL | Web design system. |
| `apps/web/e2e/README.md` | UPDATE | Keep as browser E2E guide; should clarify auth skips when API/seed unavailable. |
| `docs/README.md` | UPDATE | Documentation index; add audit and next-phase plan. |
| `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | UPDATE | Keep as product source of truth; avoid production-ready wording without proof. |
| `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | UPDATE | Keep as functional source of truth; avoid readiness claims. |
| `docs/project/SCHOOLOS_PROJECT_STATUS.md` | UPDATE | Current status should be audit-led and conservative. |
| `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | UPDATE | Keep as implementation backlog; next execution path moves to next-phase plan. |
| `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | KEEP_AS_CANONICAL | New canonical audit. |
| `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | KEEP_AS_CANONICAL | New focused delivery path. |
| `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | KEEP_AS_CANONICAL | Architecture/security source of truth. |
| `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | KEEP_AS_CANONICAL | Platform/school operations boundary. |
| `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | KEEP_AS_CANONICAL | Active web design plan. |
| `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | KEEP_AS_CANONICAL | Active mobile design plan. |
| `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | UPDATE | Keep as operations runbook; clarify it is procedure, not proof. |
| `docs/archive/README.md` | KEEP_AS_CANONICAL | Archive policy. |
| `.cache/corepack/v1/pnpm/10.12.1/README.md` | REMOVE_AS_REDUNDANT | Tool cache artifact, not active repository documentation. No repo doc link should target it. |

No active Markdown documents were deleted or archived in this audit. The consolidation action is to make this audit and `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` the active readiness and execution references, while keeping existing product, architecture, design, and runbook documents in their proper lanes.

## Critical Blockers

1. No staging deployment evidence.
2. No production environment validation with real secrets and HTTPS origins.
3. No backup restore drill or rollback rehearsal.
4. External providers and object storage are not verified.
5. No controlled-pilot workflow evidence from a real school.
6. Physical-device QA, signed mobile release configuration, and staging mobile QA are missing.

## High-Priority Gaps

- Run the authenticated browser E2E suite against staging once staging exists.
- Turn the manual Android emulator checklist into repeatable QA evidence and rerun it against staging/physical devices.
- Execute staging `prisma migrate deploy`, seed, `/health`, `/ready`, browser smoke, mobile smoke, provider readiness, and restore drill.
- Keep `pnpm smoke:pilot` repeatable in local/staging runs as seed and role fixtures evolve.

## Medium-Priority Gaps

- Add a committed web env example or documented web env matrix.
- Expand observability evidence: deployed logs, queue dashboards, alerts, and on-call procedures.
- Record browser accessibility and responsive QA beyond contract tests.
- Keep app-level E2E README aligned with actual skip behavior.
- Address Flutter plugin Kotlin Gradle Plugin deprecation before it becomes a build blocker.

## Deferred Items

- M14 Intelligence/AI remains `DEFERRED`.
- Broad student mobile app remains `DEFERRED`; mobile remains companion/persona-scoped.
- Kubernetes, microservices, search clusters, GPU services, and unrelated architecture rewrites remain out of scope.

## Do Not Claim Yet

Do not claim any of the following until the required proof exists:

- Production-ready for a real school.
- Multi-school production-ready.
- Staging verified.
- External provider verified.
- Object storage verified.
- Backup/restore verified.
- Staging authenticated browser E2E complete.
- Android/iOS release-ready.
- Real pilot completed.
- Staging seed idempotency verified for the current large demo dataset.
