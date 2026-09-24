# SchoolOS Phase 0 Baseline Certification

Updated: 2026-09-24 (initial audit 2026-09-21). Scope: **Phase 0 / Slice 0A only**. This is an evolving audit and verification record, not another repository-wide source of truth. `AGENTS.md` and its recognized execution documents retain their authority. No Phase 1 authorization migration or product redesign is authorized by this report.

## Repository Baseline

- Repository: `https://github.com/erwinshrestha17/SchoolOS`, local `/Users/erwin/Projects/SchoolOS`.
- Branch: `main`; no feature branch. The master plan explicitly permits main with coherent commit boundaries.
- Starting SHA: `6240ed7fc62c65a7d10f3fb851a775db8ebefe2a`. Initial tree clean. `git fetch origin` and `git merge --ff-only origin/main` reported already up to date.
- Final **implementation and local-verification target SHA**: `05f53d8ddd7495b72cc4e09ca2f6528541fd8ebe`. Every packaged local gate ran on this exact clean commit; the manifests also record a clean tracked tree after each command. The first report/evidence delivery commit was `cb7544ca129913fe171799f0f0db63caf51f2dd1`. A report cannot contain its own final Git hash; the exact final delivery SHA and its full CI result are recorded in the delivery response.
- [Full manual-dispatch CI run 35941980611](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35941980611) passed on implementation SHA `05f53d8d`; [full run 35944018579](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35944018579) passed on report/evidence SHA `cb7544ca`. Both `verify` and `mobile` had no skipped steps, and hosted Web E2E passed 33/33. The previous [full run 35868752421](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35868752421) on `38ebaa67` failed one Web notice smoke assertion; this is recorded as a repaired baseline defect.
- Five later documentation-only commits ending at `88e80815488935fa4a61efc4f097689e3b1d95d0` updated `AGENTS.md` and the four recognized playbooks/roadmap with Nepal education, HR policy and teacher-eligibility requirements. The application, Prisma, migration, test and CI bytes remain identical to `cb7544ca`; this audit update classifies the newly explicit gaps below. [Push run 35946293788](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35946293788) succeeded on `88e80815` but skipped browser and Flutter through path filters, so it is not cited as a full final-SHA certification.
- The initial audit's locked logs and checksums remain in [evidence/](evidence/README.md). The complete same-SHA continuation package, command/exit manifests and SHA-256 checksums are in [evidence/continuation-2026-09-24/](evidence/continuation-2026-09-24/README.md). Earlier checkpoint logs are historical only.

| Tool | Observed version / boundary |
| --- | --- |
| Host Node | 24.15.0 initially |
| Verification Node | 22.23.2, selected explicitly to match CI major 22 |
| pnpm | 10.12.1; packageManager unchanged; the later lockfile pins Prettier 3.8.3 for reproducible formatting |
| Prisma client / CLI | 7.8.0 |
| PostgreSQL | 16.13, cached `postgres:16-alpine`, isolated loopback port 55433; hosted starting run used 16.15 |
| Redis | 7.4.8, isolated loopback port 56379; hosted starting run used 7.4.11 |
| Flutter | 3.44.0, framework 559ffa3f75, macOS 27.0 (26A428) arm64; matches CI Flutter version |
| Dart | 3.12.0 |

The audit used disposable PostgreSQL/Redis containers, not the development school database. Additional explicitly opted-in databases were `schoolos_auth_recovery_test` and `schoolos_admission_atomic_test`. At `05f53d8d`, new empty database `schoolos_slice0a_05f53d8d_clean` replayed all 112 migrations and the canonical seed with no manual repair and no schema drift. A separate target `schoolos_slice0a_05f53d8d_restore` was used for recovery proof.

### Canonical commands and configuration

These were read from root/workspace package scripts, Prisma config, Playwright config, and `.github/workflows/ci.yml`, rather than inferred from roadmap prose.

| Concern | Canonical command / important distinction |
| --- | --- |
| Install | `pnpm install --frozen-lockfile`; mobile `flutter pub get` |
| Format | `pnpm format:check` now checks Core, API and Web using pinned Prettier; workspace `format:check` scripts are also available. CI still has its historical API write/diff step. |
| Root lint | `pnpm lint`: artifact/import checks, all three format checks, API ESLint and Web ESLint. `f312e6b9` closed the former coverage gap. |
| API lint | `pnpm --filter @schoolos/api lint:check`; do not use mutating `lint` for certification |
| Core lint | `pnpm --filter @schoolos/core lint` (TypeScript no-emit) |
| Typecheck | `pnpm typecheck`, ordered core build → API → Web |
| Prisma | `pnpm db:generate`; `pnpm db:validate` |
| Generated contracts | `pnpm compile:artifacts`; `pnpm verify:tracked-artifacts`; `pnpm verify:openapi`; `pnpm check:core-imports`; `pnpm check:core-dist` |
| Unit/component | `pnpm test`: API Jest + Web Node test runner. Core `test` is an explicit no-tests placeholder |
| API E2E | `pnpm test:e2e`; Nest HTTP tests include mocked persistence/providers; not a substitute for PostgreSQL integration |
| Integration | `pnpm test:integration`; auth/admission concurrency suites additionally require explicit guarded test-database URLs |
| Migration / drift | `pnpm db:migrate` adds QR preflight before `prisma migrate deploy`; CI uses direct deploy and now runs `pnpm db:verify:drift` |
| Seed | `pnpm db:seed`; Prisma 7 `apps/api/prisma.config.ts` specifies `tsx prisma/seed.ts` |
| Build | `pnpm build`; API/core compile, then Web production build |
| Web E2E | `pnpm test:web:e2e`; six essential spec files; wrapper runs fixture cleanup; Playwright standalone server on 3101 |
| Flutter gates | `dart format --output=none --set-exit-if-changed lib test`; `flutter analyze`; `flutter test` |
| Local startup | `pnpm dev`; compiled API `pnpm --filter @schoolos/api start`; Web standalone E2E runner |

Do not treat old `package.json` Prisma seed metadata (`seed.ts && seed-monthly-fees.ts && demo-seed.ts`) as the effective Prisma 7 seed command. `prisma.config.ts` is the active configuration. Explicit Platform bootstrap is `pnpm db:seed:platform` with required seed values; the ordinary school seed does not authorize inventing Platform credentials.

## Current CI Failure and Baseline Repairs

[Starting-SHA CI run 34967719803](https://github.com/erwinshrestha17/SchoolOS/actions/runs/34967719803) failed in `verify` / **Verify API formatting**. Exact step: `pnpm --filter @schoolos/api exec prettier --write "src/**/*.ts" "test/**/*.ts"` followed by `git diff --exit-code -- apps/api/src apps/api/test`. The only resulting file diff was `communications.service.spec.ts`. Later verify steps did not run. The successful Mobile job skipped setup, formatting, analysis, and tests because its path filter was false.

Bounded repairs:

1. Format the actual failing communications fixture; explicitly widen its mutable channel to `NotificationChannel` so SMS/EMAIL/IN_APP scenarios compile.
2. Supply the required `AuthContext` fields in the mobile homework integration fixture instead of an incomplete cast.
3. Dispose the Flutter semantics handle in `finally` before end-of-test invariant checks; preserve all screen-reader action assertions.
4. Make the compact Parent navigation test use the Updates tooltip and scroll to the offscreen notice before asserting. No UI change or assertion deletion.
5. Let the Web documentation-contract test accept the current equivalent phrase “If this file conflicts…” while retaining the AGENTS-wins assertion.
6. Explicitly select production mode for Next build and the standalone E2E server. A development-mode build failed prerendering with null `useState`; production mode passed on the same source.
7. Declare isolated-database scope for integration-test PostgreSQL lock diagnostics and a temporary-table migration probe. Production fail-closed Prisma rules remain unchanged.
8. Add manual full workflow dispatch to bypass path skipping and provision the two guarded concurrency databases in CI. The first full dispatch on `38ebaa67` exposed the notice smoke timing defect; the repeat full dispatch passed on `05f53d8d`.
9. At `cef2d658`, match Prisma metadata to existing migration/index names and two existing `updatedAt` defaults; add `pnpm db:verify:drift` to scripts and CI. Migration files, SQL-only partial indexes, and `NULLS NOT DISTINCT` constraints were preserved. The 112 migration hashes were unchanged.
10. Keep exact JWT-protected `GET /api/v1/auth/me` on the ordinary API rate budget while credential/refresh/recovery operations retain the strict budget. Six guard regressions and paced browser sign-in fixtures cover this distinction.
11. Bootstrap separate synthetic Platform and account-security/admissions fixtures in CI; enable previously optional admission browser checks. Repair a Platform-denial hydration race, CSV phone fixture, timetable summary request, and server-response label assertion at their test or request source.
12. Update ten macOS Flutter goldens only after original source commit `8f8692675b7ed45a8bea2723834126b732f57df7` and the current checkout rendered byte-identical images on this host. The pixel threshold and assertions were unchanged. The comparison and archived source-file checks are in the locked `golden-provenance.json`.
13. Apply the existing restore-target safety guard before backup rehearsal can connect, back up, or recreate its target. A subprocess regression rejects source-as-target against an unreachable synthetic endpoint. Local PostgreSQL and synthetic-file restoration then passed separately.
14. At clean checkpoint `f312e6b9`, pin Prettier 3.8.3, add canonical Core/Web format scripts and root checks, format tracked source, and make generated Core artifacts formatting-stable. A 565-file comparison against the prior checkpoint found one non-format-only movement: an ESLint comment repositioned to keep the Web zero-warning lint gate effective. No authorization or design-system migration was intended.
15. At `38ebaa67`, repair API ESLint and TypeScript diagnostics in production/test code without disabling rules or deleting tests; root `pnpm lint` now completes with zero API errors (3,660 existing warnings). A bounded report CSV scalar-serialization regression and scheduled-notice count contract were corrected with tests. Full API unit, HTTP E2E and integration suites passed after these changes.
16. At `05f53d8d`, repair the hosted notice smoke's premature assertion: await the exact successful publish POST response before requiring the Published badge. The prior hosted API call returned HTTP 201 after about 11.6 seconds, while the original badge wait expired at 10 seconds; a disposable local runtime proved the repaired flow with a single 18.8-second publish and 6/6 notice cases. The full 33-case local browser suite then passed on the clean committed SHA.
17. A later full run on audit SHA `088054ac` passed both CI jobs but Playwright reported one flaky Platform route-denial case (32 first-pass, one retry pass). The first attempt found neither visible denial nor a matching 401/403 after sampling the URL only once, 300 ms after navigation. `PlatformLayout` can redirect a school user to `/dashboard` after that sample; no protected Platform dashboard API request was found in the hosted API log. The test now observes allowed redirect, explicit denial or matching denied API response throughout a bounded wait, rejects a successful protected Platform API response, and checks absence of the actual operator dashboard heading. This repairs the evidence assertion without changing Platform authorization. The exact first-attempt DOM was not preserved by CI, so the timing explanation remains source/log-supported rather than screenshot-proven.

The repairs did not migrate role presets, permission grants, typed scopes, or the authorization architecture. No migration SQL changed. The final diff and same-SHA suites are the basis for the bounded implementation claim; they are not Phase 1 completion evidence.

## Verification Results

Every local PASS below is from the exact clean implementation SHA `05f53d8d`, recorded in [the checked evidence package](evidence/continuation-2026-09-24/README.md). JSONL manifests give command, exit code, SHA and post-command tree state; compressed logs preserve test counts and diagnostics. `SHA256SUMS` verified the package bytes. A zero exit with skipped tests is not a full pass; the local test totals below had no skipped tests in their reported suites.

| Gate | Result | Evidence |
| --- | --- | --- |
| Frozen install, Node 22 | PASS | `results.jsonl`, `install.log.gz`; pinned pnpm/Prettier lockfile used |
| Staging/production deploy environment preflight | NOT APPLICABLE | `environment.log.gz`: `pnpm verify:env:deploy` exited zero because `DEPLOY_ENV`/`NODE_ENV` was development and explicitly **skipped** the staging/production checks; no deploy-environment readiness is claimed |
| Compile generated/shared contracts, tracked artifacts | PASS | `generate.log.gz`, `tracked.log.gz`, `lint.log.gz`, `typecheck.log.gz`; no tracked artifact drift |
| Prisma generate / validate | PASS | `generate.log.gz`, `validate.log.gz`; Prisma 7.8.0 |
| Core lint / typecheck / build / import boundaries / dist | PASS | `core-lint.log.gz`, `lint.log.gz`, `typecheck.log.gz`, `build.log.gz` |
| Core standalone tests | NOT APPLICABLE | Package script explicitly contains no tests; shared behavior exercised by API/Web tests, not claimed as a core suite |
| Core/API/Web formatting | PASS | `format.log.gz`; canonical `pnpm format:check` checked all three workspaces |
| OpenAPI gate | PASS | `openapi.log.gz`: 1,152 paths, 1,334 operations, 475 schemas |
| API ESLint / root lint | PASS | `lint.log.gz`: **0 errors**, 3,660 API warnings; Web ESLint ran with `--max-warnings=0`. Existing warning policy was not relaxed |
| API and Web typecheck | PASS | `typecheck.log.gz`; ordered Core build, API, Web |
| API unit tests | PASS | `unit.log.gz`: 273 suites, 3,119 tests |
| API HTTP E2E | PASS | `api-e2e.log.gz`: 43 suites, 294 tests |
| PostgreSQL integration, all opt-ins enabled | PASS | `integration.log.gz`: 12 suites, 202 tests with guarded auth/admissions databases |
| Empty supported DB migration / canonical seed | PASS | `database-results.jsonl`, `empty-migration.log.gz`, `canonical-seed.log.gz`: 112 migrations from empty PostgreSQL 16, then canonical seed |
| Migration history status and schema drift | PASS | `migration-history.json`: 112 SQL migration hashes unchanged from starting SHA; `migration-status.log.gz` up to date; `migration-drift.log.gz` reports no difference |
| API production build and runtime health | PASS | `build.log.gz`, `api-runtime.log.gz`; compiled API served `GET /api/v1/health` with HTTP 200 during browser run |
| Web lint / typecheck / production build | PASS | `lint.log.gz`, `typecheck.log.gz`, `build.log.gz`; `web-build-audit-api.log.gz` rebuilt with the audit API base URL |
| Web unit/component contracts | PASS | `unit.log.gz`: 666 tests, zero skipped; many are source contracts rather than rendered-component tests |
| Essential Chromium Playwright smoke | PASS | `browser-results.jsonl`, `web-playwright.log.gz`: 33 authenticated browser cases passed, no skips |
| Browser audit-infrastructure isolation | PASS | `browser-results.jsonl`, `web-playwright.log.gz`, `api-runtime.log.gz`: a new `05f53d8d` database and empty disposable Redis on port 56382 passed all 33 cases; zero usage-counter foreign-key errors |
| Flutter dependency / format / analyze / widget-golden tests | PASS | `flutter-results.jsonl`, `flutter-*.log.gz`: 808 tests including ten same-host goldens; provenance locked separately |
| Local PostgreSQL and synthetic-file backup/restore | PASS | `backup-restore-result.json`: exit 0; all 273 public-table row digests and the synthetic storage-file SHA-256 match source to restore |
| Physical Android/iOS, live providers, cloud/staging recovery | NOT APPLICABLE | Outside Slice 0A's device-independent/local baseline; no readiness claim and later controlled verification remains |
| Hosted full CI on implementation SHA | PASS | [Manual full run 35941980611](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35941980611) on `05f53d8d`: `verify` and `mobile` succeeded with no skipped steps; hosted Web E2E 33/33; `hosted-ci.json`, `hosted-verify-job.log.gz` |
| Hosted full CI on first report/evidence SHA | PASS | [Manual full run 35944018579](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35944018579) on `cb7544ca`: both jobs succeeded without skipped steps; this commit changed only the Phase 0 audit and evidence files from `05f53d8d` |
| Authority-document delta review | PASS | `git diff cb7544ca..88e80815`: only `AGENTS.md` and the four root execution documents changed; H09–H11 and the new policy/data classifications below reconcile the expanded authority with unchanged implementation |
| Hosted browser assertion on pre-repair audit SHA | FAIL | [Full run 35964903946](https://github.com/erwinshrestha17/SchoolOS/actions/runs/35964903946) on `088054ac`: jobs succeeded with no skipped steps, but browser smoke was 32 first-pass plus one flaky Platform route-denial retry; treated as an evidence-gate defect pending clean post-repair CI |
| Clean implementation-SHA certification | PASS | Every packaged local gate and the hosted full workflow passed on clean `05f53d8d`; the later test-and-audit delivery SHA requires its own clean full-workflow result, recorded in the delivery response |

### Evidence limits

- **Hosted CI:** Both previous `38ebaa67` runs failed at the Web notice smoke after prior verify gates passed; the full dispatch also passed Mobile. The defect was a premature 10-second UI assertion while publish took about 11.6 seconds and returned HTTP 201. The committed repair awaits the response and still requires the Published badge. The full dispatch on `05f53d8d` then passed both jobs and all 33 browser cases.
- **Later authority delta:** The new P0-N1–N4 roadmap gate constrains future Phase 6/7 implementation; it does not authorize implementing those foundations inside audit-only Slice 0A. The `88e80815` push run skipped Web E2E and Flutter, so its success alone does not certify a final SHA. The last full run before this authority update was `cb7544ca`; final-delivery full CI is checked separately.
- **Pre-repair browser flake:** Run `35964903946` finished green at the workflow level but retained one retried Platform-denial failure. The report classifies the first-pass browser gate as FAIL rather than counting a retry as 33 clean first-pass cases; the bounded test correction must pass on the final SHA.
- **API warnings:** The formerly failing API ESLint gate now exits zero with zero errors. Its 3,660 warnings are recorded rather than silently described as a zero-diagnostic result. No rule/threshold was weakened to obtain the pass.
- **Golden provenance:** The ten regenerated images match original-source renders byte for byte on this same host. This isolates them from intervening app-source changes; the original creation host is unknown, so no precise OS/engine cause is asserted and no threshold was widened.
- **Browser fixture history:** Earlier runs failed because of the `/auth/me` rate policy, absent synthetic Platform bootstrap, fixture validity, and an asynchronous redirect assertion. The bounded repairs were verified by the 33/33 browser run on `05f53d8d`, built with its API base URL at build time.
- **Audit Redis contamination:** An earlier browser run reused `usage:pending` values for tenant `481276f8…` from the earlier `schoolos_baseline` database, which was absent from that run's database. The exact `05f53d8d` browser run used a new seeded database and empty disposable Redis, passed 33/33, and logged zero usage-counter foreign-key errors. This confirms evidence-run isolation, not cross-tenant request access. UsageService's indefinite retry of a permanently deleted tenant's delta remains a bounded operational follow-up.

## Implementation Classification

“Correctly implemented” below applies to the named bounded mechanism and supporting tests, not whole-module release readiness.

| Capability | Status | Evidence | Next Action |
| --- | --- | --- | --- |
| Nest API/domain organization | correctly implemented | Controllers/services/modules in `apps/api`; `05f53d8d` compiled and passed 3,119 unit/294 HTTP tests | Preserve architecture; continue bounded security review |
| Prisma top-level tenant enforcement | correctly implemented | `prisma.service.ts` rejects missing context, overwrites client tenant predicates, rejects unsupported operations; tenant-isolation integration | Preserve; audit nested writes/raw SQL separately |
| Authentication revocation/rotation | correctly implemented | Live JwtAuthGuard session-family/user checks; authVersion transactions; auth concurrency integration | Preserve; device/offline boundary testing |
| Teacher assignment-scope engine | correctly implemented | `teacher-scope.service.ts` checks active Staff, effective-dated assignment/delegation, exact resource/capability and lifecycle; Attendance/Marks callers and scope suites pass. This classification covers assignment scope, not professional eligibility | Preserve the engine; add separate policy precondition at P0-N3 / Phase 2B/5M/6 |
| Teacher employment/professional eligibility | unsafe | `TeacherScopeService` and assignment/replacement creation do not consult an effective-dated employment/licence/eligibility decision; `StaffQualification` has no verification/licence/policy fields (H09) | P0-N2/N3; Phase 5J–5M and Phase 6 teacher gate |
| Guardian capability engine | correctly implemented | `parent-scope.ts`, ParentScopeContextService, guardian integration and child-denial tests | Preserve; complete call-site/projection coverage |
| Platform domain/support boundary | correctly implemented | PlatformGuard, explicit global grants, purpose/expiry/read-only support allowlist | Preserve; fixture/hosted verification |
| Permission catalog/aliases | partially implemented | Core catalog, alias map, role snapshot; mixed two/three-part vocabulary | Phase 1A |
| Role templates | conflicting | Admin all-except and Principal accounting catalog filter conflict with explicit-allowlist target | H01 / Phase 1A.1–1A.2 |
| Typed school role scopes | missing | UserRole.scopeId is generic; AuthzCacheService discards school scope from effective grants | H02 / Phase 1C–1D |
| Central decision kernel | documentation-only | Blueprint target; current guards/domain services already implement substantial enforcement | Phase 1B after baseline; wrap existing mechanisms |
| Student protected-data projection | unsafe | General profile returns medical/restriction/identity and financial sections; only support is explicitly redacted | H03 / Phase 3B, 5F |
| Staff protected-data projection | partially implemented | Staff serializer drops raw User; masks bank/identity/salary without HR/payroll grant | Review broad hr:manage semantics in Phase 2D/3B/7H |
| Employment and professional evidence | partially implemented | Staff, StaffContract, StaffQualification and StaffDocument exist; no distinct policy-backed Employment/Teacher Profile/licence/eligibility history or fine-grained professional-evidence projection | P0-N2/N3; Phase 5J–5M/7G–7L |
| Nepal education/grading policy history | unsafe | Admission policy versions exist, but grading scale/rounding are mutable tenant settings and report-card PDF rebuilds subject grades with current policy (H11) | P0-N1; Phase 6E–6H |
| Nepal HR/statutory payroll policy | unsafe | Effective-dated salary/contract records exist, but approved jurisdiction/school/post policy version is absent and payroll uses fixed PF/TDS rates (H10) | P0-N2; Phase 7P–7R; no statutory correctness claim |
| External government-authority handoff | partially implemented | IEMIS export identifies `REPORTING_READINESS_HANDOFF` and `SCHOOL_OS_INTERNAL_RULE_SET`; no live NEB/IEMIS/TSC authority acknowledgement or verified licence integration | Preserve truthful handoff; P0-N4 before any external integration claim |
| Finance and payroll SoD | partially implemented | Manual journal creator cannot approve; Accountant combines many capabilities; HR prepares/reviews. Direct privileged refund/reversal routes do not require a reviewed FinanceApprovalRequest (H07) | Phase 2C/2D; retain current checks |
| School role grant governance | unsafe | School Configuration Owner can create tenant roles, grant any non-Platform permission and assign the role to self; no grant ceiling or self-escalation check in the reviewed service path (H08) | Phase 8A–8E with Phase 1 authorization-policy prerequisites |
| Receipt/payment/ledger integrity | partially implemented | Decimal storage, sequences, unique provider/idempotency keys, reversal lineage, finance tests | Full concurrent recovery/restore evidence still required |
| Reports/queued exports | unsafe | Teacher scope exists; queued generic export uses stale actor snapshot | H04 / Phase 9F with Phase 1/2 policy dependencies |
| Protected files | partially implemented | Tenant, upload status, owner/module checks, signed TTL and support prohibition | H05; audit generic notice audience/lifecycle |
| M12 notification delivery | partially implemented | Persisted events/deliveries, retries, current recipient/source checks, stale-attempt tests | Provider/failure/recovery verification; preserve M15/M12 split |
| Redis authorization behavior | correctly implemented | Role and entitlement resolution now read live; request memo only; compatibility cache invalidation remains | Correct stale comments, retain live authority |
| Web shell/state/primitives | partially implemented | Shared session provider, query cache teardown, shell/navigation and UI primitives; 33/33 browser smoke passed at `05f53d8d` | Retain existing primitive families; broaden visual/accessibility proof in later work |
| Mobile shell/auth/cache/drafts | partially implemented | Riverpod/GoRouter/Dio/secure storage, scoped private cache, biometrics and sync envelope; 808 widget/golden tests passed at `05f53d8d` | Device/offline revocation verification |
| New education/HR/eligibility Web and Mobile workspaces | documentation-only | Later Web/App playbook sections specify policy governance, professional status, leave coverage and statutory readiness; their commits changed no `apps/web` or `apps/schoolos_mobile` files | Implement only after server policy/projection prerequisites in owning future slices |
| Learning/deferred services | partially implemented | Existing code/tests remain despite active scope freeze | Keep isolated; do not activate or delete merely for audit |
| Broad future kernel/JIT/typed grant roadmap | documentation-only | Execution blueprints describe future state | Do not claim implemented |
| Cloud storage, real delivery, device biometrics | external dependency | Adapters/scripts exist; local PostgreSQL/file restore passed, but no live provider/physical-device/staging recovery run | Separate controlled evidence |

### Architecture and design primitive inventory

- `packages/core`: permission catalog/aliases/presets, API contracts, entitlements, date/localization; build consumed by API and Web. Core standalone test script has no suite.
- `apps/api/prisma/schema/*.prisma`: canonical split inputs; `schema.prisma` is compiled. 112 immutable migration files inventoried with SHA-256. Prisma 7 adapter uses PostgreSQL.
- `apps/web`: Next App Router, React Query, session provider; shared shell and persona navigation, components under `components/ui`, module workspaces, dashboard primitives. Existing `card`, `section-card`, `summary-card`, `operational-summary`, `data-table`, `workspace-states`, drawer/dialog/form components coexist. This is an inventory, not evidence that a third design system is needed. The 33-test browser smoke is bounded functional evidence, not comprehensive visual/accessibility certification.
- `apps/schoolos_mobile`: `lib/app`, `core`, `features`, `shared`; Riverpod state, GoRouter persona routing, Dio auth, OS biometrics, secure storage, private cache, draft stores, sync adapter, push/deep links. Noncanonical/deferred persona code remains but does not change active product scope.
- Redis/BullMQ: notifications, finance, payroll, reports, accounting reports/imports, homework, academics, activity media, advanced operations; `runTenantScopedJob` checks tenant liveness and enters CLS. This does not by itself refresh the actor's current permission graph.
- Storage: local, S3-compatible, and GCP adapters; FileRegistry owns asset metadata and protected access; provider configured success is not provider execution proof.
- CI: one Node verify job and path-filtered Flutter job; new manual dispatch forces Web/Mobile execution. Golden tests are intentionally macOS-local and excluded from Linux CI.

## Role → Permission Matrix

The complete catalog-by-role Boolean matrix is [role-permissions.csv](role-permissions.csv), including **direct grants and effective alias grants**, not just role names. [role-summary.json](role-summary.json) records counts, literal wildcards, and Platform grants. These are source-defined presets, not a claim that every existing deployed tenant's persisted role rows match them. Ordinary seed database is synthetic.

| Built-in role | Direct keys | Current grant model / concern |
| --- | ---: | --- |
| Admin | 222 | All tenant keys except finance roots/settings and removed chat writes; future non-finance inheritance (H01) |
| School Configuration Owner | 32 | Explicit settings/delegation/user/role operations; distinct from Platform; broad ability to manage school access |
| Principal | 65 | Explicit oversight/approval lists **plus dynamic accounting read/report catalog subset** (H01) |
| Teacher | 42 | Explicit list, attendance mark; effective assignment service still required; no broad financial grant |
| Subject Teacher | 39 | Explicit list; no attendance:mark by default; subject/component scope remains authoritative |
| Support Staff | 6 | Narrow staff/notices/events/settings; retained compatibility persona |
| Student | 10 | Explicit student-learning/homework set; active roadmap does not broaden student app |
| Parent | 14 | Explicit self-service; guardian capabilities separately govern child access |
| Accountant | 65 | Create/submit/approve/post/reverse/fiscal-reopen/reconciliation-finalize coexist; journal self-approval denial remains |
| Financial Auditor | 25 | Read/export; time-bounded assignment mechanism exists; expiry checked live |
| HR Manager | 36 | HR/leave, salary preparation, payroll create/review and payslip; not full accounting posting |
| Librarian | 6 | Explicit deferred-module role; aliases expand broad library permissions |
| Driver | 5 | Explicit transport operations; resource/driver checks remain separate |
| Platform Super Admin | 28 | Explicit Platform permission set including tenants:manage; PLATFORM domain and global grant required |
| Platform Support | 10 | Platform observation only; no support override issuance grant |
| Platform Billing Admin | 9 | Platform subscriptions/billing subset; no school finance authority |

No literal `*` grant was found in these presets. No Platform permission key is directly assigned to a school preset. Absence of literal `*` does **not** make Admin's all-except filter safe against future inheritance. Permission aliases must be considered when evaluating effective SoD.

The later RBAC playbook names `hr:employment:*`, `hr:qualification:*`, `hr:teaching_license:*`, `hr:teacher_eligibility:*`, `hr:compensation:*` and `hr:statutory_membership:*` as future vocabulary. These keys are not present in the current Core catalog or built-in role snapshot. They are documentation targets, not grants proved by this matrix.

## Endpoint → Authorization Matrix

- [endpoint-declarations.csv](endpoint-declarations.csv): AST-derived inventory of **1,336 method declarations across 110 controller files**, including inherited/method permissions, guards, entitlement markers, support scopes and service calls. This is not a claim of 1,336 deployed operations: OpenAPI reports 1,334 operations; declaration inventory includes routes outside its exposed contract.
- [endpoint-authorization-reviewed.csv](endpoint-authorization-reviewed.csv): **72 selected sensitive operations** with route/controller, permission, entitlement, tenant/resource/relationship scope, lifecycle, SoD, downstream evidence and known gap. The expanded sample includes role grants, direct and reviewed finance actions, teacher assignment/replacement, marks/results, grading settings/PDF, payroll creation, guardian administration, notices, and Platform support override.
- Downstream families inspected include authentication, students, Parent child scope, Teacher attendance/marks, roles, payroll/manual journal, reports/exports, files, queues and Platform support. Unreviewed declaration rows are explicitly labeled inventory-only. This is not exhaustive service-path security certification; do not promote it to one.

Cross-cutting facts: JwtAuthGuard derives effective tenant from verified identity; Prisma enforces top-level tenant operations; school routes with RolesPermissionsGuard use required permission **AND** semantics with aliases. `RolesPermissionsGuard` returns true for SCHOOL requests with no role/permission metadata; some such routes implement self-service or module checks inside services. It is therefore not a universal “missing permission metadata always denies” kernel. EntitlementGuard fails missing entitlement declarations closed where installed. PlatformGuard has a separate domain/role/permission path. Guard presence alone does not prove row or field scope.

## Persona → Scope Matrix

| Persona | Current resource boundary | Evidence / limitation |
| --- | --- | --- |
| Parent | Authenticated tenant/user → active, VERIFIED, APPROVED, effective guardian link → capability → exact child | `parent-scope.ts`, ParentScopeContextService, MobileService; denied child is not substituted |
| Teacher | Active Staff → tenant/year/class/section/subject/component → assignment/delegation capability; ownership/lifecycle where required | TeacherScopeService and Marks/Attendance preserve precise assignment scoping; current employment/licence/eligibility policy is not checked (H09) |
| Principal | Tenant oversight plus explicit approvals, lifecycle/domain policy | Preset is not universal write authority; dynamic accounting subset still needs 1A |
| Admin | Tenant operational permissions excluding finance roots | All-except future inheritance; not Platform; no typed grant scope in effective role projection |
| HR | Tenant staff/leave/payroll preparation; sensitive serializer controlled by HR/payroll permissions | Broad hr:manage allows sensitive data; professional-evidence categories and statutory-policy versioning absent (H09/H10); full actor separation incomplete |
| Accountant | Tenant fee/accounting operations with state checks | Creator cannot approve own manual journal; remaining multi-action combination requires SoD policy |
| Platform Operator | PLATFORM identity/global grant; target school access only active scoped read-only support override | Exact override ID/reason/expiry and approved route; protected files prohibited |

## Protected Data Matrix

| Data | Who currently receives it / projection | Evidence / gap |
| --- | --- | --- |
| Student identity | students:read; assigned teacher scope; Parent child-specific projection | StudentsService profile; broad identifiers in general profile (H03) |
| Guardian contacts | General student profile includes guardian contact fields; Parent path linked context; support special projection | `getStudentProfile`, `getSupportStudentProfile`; no uniform sensitive-field capability |
| Custody/restrictions | Guardian relationship restrictionReasonRef emitted on general profile except support | StudentsService guardian mapping; H03 |
| Medical/safety | General student profile returns medicalConditions, allergies, medications, specialNeeds, doctor fields | H03; Mobile profile separately gates medical summary by consent |
| Academic records | Teacher assignment/summary capability; Parent ACADEMICS_VIEW | Marks/teacher scope/Parent capability engine |
| Marks/results | Entry ownership, exact subject/component, locks; Parent published-result path | Existing Marks/academics tests; generic report publication predicates still require full inventory |
| Student documents | File registry tenant + linked student access; response removes object keys/raw public URLs | FileRegistryService + student-profile-sanitizer; raw key stripping is not full field projection |
| Staff documents | HR/staff permissions and protected owner/module file paths | Staff service/file registry; no exhaustive document subtype audit claim |
| Staff employment/contract | Staff/StaffContract tenant records and HR/staff projections | Contract dates exist; no separate policy-backed, effective-dated Employment decision or complete historical projection (H09/H10) |
| Qualifications/licence/eligibility | Own-staff or HR-managed Staff detail includes `qualificationsRecords`; ACADEMIC_CERTIFICATE exists as a StaffDocument kind | No verified qualification/licence/eligibility state or dedicated category projection; blueprint categories remain documentation-only (H09) |
| Staff medical/disciplinary/safeguarding | No dedicated StaffDocument kind or category projection was found; current enum has generic `OTHER` | Recipients of such records cannot be certified from a non-modelled category; do not treat generic staff-read as evidence of safe access |
| Staff bank details | Masked without hr:manage/payroll:manage/payroll:salary:read | Staff serializer removes raw User relation; hr:manage remains broad |
| Salary/payroll | Salary structures/payroll lines masked without sensitive grants; own payslip checks linked Staff | PayrollService/StaffService; role and actor SoD partial |
| Finance/accounting | Accountant/financial auditor and Principal-safe summaries; export registry permissions | General student profile exposes financial sections under students:read; H03 |
| Audit/security | Separate school audit and Platform audit surfaces; support audit evidence | Platform/roles/auth audit services; central deny-decision schema remains future work |
| Exports | Registry + scope at enqueue/download; actor snapshot at generic worker | H04: queued actor revocation not reloaded |
| Protected files | Asset tenant/uploaded state, owner/module policy; support blocked; signed read TTL capped (default 300 seconds) | H05: generic notice branch lacks source audience/lifecycle; issued provider URL cannot instantly reauthorize |

## Tenant Isolation Findings

No cross-tenant access was confirmed by the exercised tests or inspected paths. This is a bounded result, not proof that every raw query, nested write, route, or worker is safe.

| Edge case | State | Evidence |
| --- | --- | --- |
| Foreign tenant IDs / top-level reads/writes | Handled in tested paths | PrismaService injects trusted tenant; tenant-isolation, guardian, teacher, protected-file integration suites |
| Client-supplied tenantId | Handled at top-level Prisma boundary | Actual where/data tenant overwritten by CLS tenant; JwtAuthGuard derives trusted context |
| Nested/mixed bulk IDs | Present but incomplete audit coverage | Service validation and integration exist; extension does not recursively scope arbitrary nested relations; many FKs use ID alone |
| Missing worker tenant | Handled by helper | runTenantScopedJob skips missing/suspended tenants; explicit bypass required outside CLS |
| Raw SQL | Partially handled | Missing context denied; SQL text itself is not rewritten to include tenant predicates |
| Cache tenant omission | No omission confirmed in reviewed auth/entitlement/Parent keys | Request memo namespaced; effective grants live; caller-constructed keys still require review |
| Foreign file ID | Handled in tested paths | File metadata tenant check and protected-file integration |
| Export actor revocation | Present, scheduled Phase 9F | H04; tenant liveness alone is insufficient |
| Notification tenant/recipient | Handled in reviewed delivery policy | Tenant/event match, current active recipient and source state; jobs carry metadata |
| Support/operator tenant access | Handled in reviewed guard/allowlist paths | PLATFORM only, active ID/reason/expiry, read-only approved scope; no permanent unrestricted override |

## Authentication Findings

| Requested behavior / edge case | Observed implementation and evidence |
| --- | --- |
| Login | Tenant slug + credentials, password policy, active-user checks; session issuance, OTP/challenge flows; auth.service.ts |
| Refresh/session | HMAC token hashes, rotation claim, family reuse revocation, current user/tenant and transaction lock checks |
| Logout/revoke/device list | Persisted refresh family revocation, owned-session listing/revoke/other-session revoke; no client role authority |
| Password reset with existing sessions | Transaction consumes proof, increments authVersion, revokes sessions/challenges/push registrations; concurrency tests passed |
| Suspended user holding access token | JwtAuthGuard queries live active user/tenant and valid session family; rejected on next server request |
| Stale refresh restoring invalid session | Revoked token family is rejected and family revocation commits; actual locking/replay tests passed |
| Expired role/session | Role expiry evaluated per request; refresh expiry/server JWT expiry enforced; generic role scope still H02 |
| Tenant/persona resolution | Server tenant/roles; Web session generation + query/offline cleanup; mobile secure credential coordinator + private-data cleanup on new identity |
| Tenant switching | No general same-session multi-school switching API established; login changes context, Platform support is distinct and bounded |
| Biometrics after server revocation | OS local auth calls loadSession; online server rejection logs out. Offline cached-session fallback can only know the last observed state; physical-device behavior not certified |
| Clock/expiry | Server Date/time and JWT expiry authoritative; tests cover expired grants/tokens; no actual clock-skew chaos/device-clock test conducted |
| Rate policy | `cef2d658` repair places exact JWT-protected GET `/auth/me` on the ordinary API budget; credential, refresh and recovery routes retain the strict budget. Six focused guard regressions and the final-SHA auth suites passed |

## Prisma/Data Integrity Findings

- All 112 migration files replayed from empty PostgreSQL 16 at `05f53d8d`, with no `migrate resolve`, history rewriting or data repair. The canonical seed ran. Schema metadata matches existing database names/defaults; migration status is current and the schema diff is empty. The migration-history manifest confirms all 112 SQL file hashes are unchanged from the starting SHA.
- User email/phone and role names are tenant-unique. UserRole contains tenantId, generic scopeId, assigned/revoked metadata and expiresAt; it has user/role FKs and a composite grant key. It has no typed scope model. Nullable grant keys and missing composite tenant FKs deserve evidence-led Phase 1C/1D review, not speculative constraints now.
- StudentGuardian has unique student/guardian pairs, active/verification/approval/effective-date/capability columns and indexes. SQL migration adds a partial unique active-primary guardian index and capability/window checks. This is more than a bare join table.
- TeacherAssignment exact scope uniqueness is recreated with `NULLS NOT DISTINCT` by the latest migration; migrations preflight duplicates. Indexed tenant/staff/year/status and class/section lookups exist. Exact tuple uniqueness is not a general exclusion constraint for all overlapping delegation/effective-date combinations.
- Staff, StaffContract, StaffQualification and StaffDocument exist, but the schema has no distinct effective-dated employment decision, verified teaching-licence/eligibility record, or policy-version link for an assignment. `StaffQualification` records degree/institution/year without verification or expiry fields; H09 identifies the authority gap rather than proposing speculative constraints.
- ReportCard and ReportCardHistory preserve totals, grade and version, and ReportCardSubjectResult persists subject grades, but there is no grading-policy-version reference. Mutable tenant `grading_scale`/`grading_rounding_policy` and current-policy PDF rendering leave historical meaning exposed to H11.
- Enrollment preserves effective dates and lifecycle; a SQL partial unique active-enrollment constraint exists. Service transitions and historical roster/version handling must remain authoritative.
- M3/M7/M11 authoritative amounts use Prisma Decimal columns. Payment/refund idempotency keys are tenant-composite; provider-reference uniqueness and tenant receipt/refund identifiers exist; ReceiptSequence provides atomic sequence state. Float-like presentation conversions are not evidence that persisted amounts use floating point.
- Journal/reversal/source mapping/posting history, payment refund lineage, payroll state and receipt reprint history exist. Application-level immutable lifecycle protection is not the same as a DB-wide immutable-table guarantee.
- `approvePayrollRun` performs line, payslip and run writes without one visible encompassing transaction; future failure-injection/atomicity review belongs to Phase 2D/7J. This audit does not claim a reproduced financial inconsistency.
- Many entity FKs are ID-only with separate tenant columns. The top-level Prisma extension cannot prove nested cross-tenant consistency; targeted mixed-tenant insertion tests remain important before typed-scope migration.

## Offline/Queue/Cache/File Findings

- Web has tenant/user scoped drafts, read cache, outbox, authority fence, and an eight-hour bounded offline-auth lease. Platform leases fail closed. Session teardown clears React Query, support state, recent items, lease/fence, attendance drafts, outbox, module drafts and read cache. Offline unsafe HTTP methods are rejected; cached permission lists are not accepted as server authority.
- Mobile private cache uses secure storage, tenant/user/role namespace, resource allowlist, byte quotas, TTL, protected-material filtering and optional authorization-scope version. Credential epochs fence late writes during logout/login. Auth failure/private cleanup and wrong-child tests exist.
- Attendance sync carries durable client submission/operation identity, roster and authorization versions; server recalculates current authority and returns explicit conflicts. Homework/marks draft stores and authority discovery code also exist; a draft store is not permission to publish/results/payments offline. All high-risk server transitions remain online-only in this audit's reviewed paths.
- Current teacher sync rechecks assignment authority, but no effective-dated employment/licence/eligibility policy decision exists to recheck (H09). A later eligibility loss therefore cannot yet invalidate teaching authority or its offline projection as the new governing contract requires.
- Disconnected clients cannot learn server revocation immediately. Existing stale/offline restrictions and next-response invalidation are not physical-device proof of prompt deletion. Test school/year/assignment/guardian transitions with reconnect and backgrounding before claiming full offline safety.
- BullMQ handlers have tenant context and retry mechanisms; notification delivery retains persisted status/retry count and rechecks stale/terminal attempts, recipient liveness and source status. Admission failure-injection integration exercises post-commit follow-up failure. This is not proof of universal DB/outbox atomic publish or exactly-once provider execution.
- Generic ReportsProcessor carries serialized AuthContext; `completeQueuedExport` consults that snapshot and current tenant, but does not reload role/user/session revocation (H04). Other worker families require their own current-actor review.
- RedisCacheService is a general primitive; comments still describe cached permissions/entitlements, while actual AuthzCacheService and EntitlementsService resolve authority live. Request memoization is distinct from cross-request cached authorization.
- File access is tenant/module/owner aware and support-prohibited. `PRIVATE` is the default asset visibility, but the generic notice branch still grants on notices:read without resolving recipient/publication state (H05). Signed provider URLs are bounded bearer links; after issuance, authorization changes do not invalidate them instantly.

## Testing Gaps

| Risk | Existing evidence | Gap that matters next |
| --- | --- | --- |
| LOW | Web source/component contracts, Flutter widgets | Source-string tests do not prove rendering |
| MEDIUM | Unit + persistence integration for selected workflows | Failure/recovery coverage varies by subsystem |
| HIGH | Teacher/guardian/Platform negatives, protected files, route denial, tenant integration | Only 72 selected endpoint operations have explicit downstream matrix review; remaining sensitive paths need review; typed scopes and field projections incomplete |
| CRITICAL | Auth recovery/admin concurrency, attendance correction concurrency, admission atomicity, finance replay/reversal tests | Not a full database-concurrency/failure-injection/restore program for every financial transition |
| Cross-tenant / negative auth | Dedicated API integration/E2E suites passed | Nested relations, mixed bulk IDs and every export/worker subtype not exhaustively tested |
| Idempotency/replay | Refresh, attendance, finance and notification stale-attempt coverage | Real provider duplicates, DB commit/queue outage and dead-letter recovery across all families |
| Migration | 112-file empty replay, guarded migration probe, empty schema diff at `05f53d8d` | Production upgrade/dirty-data preflights remain distinct from a clean replay |
| Financial reversal | Journal/payment/payroll lineage tests present | Live PostgreSQL competing-actor rollback/reversal and end-to-end recovery evidence |
| Offline/sync | Scope/version/conflict/cache tests | Actual device offline revocation, year change, app resume, prolonged disconnection |
| Teacher eligibility | Active Staff and assignment tests exist | No verified licence/qualification or policy-version fixture, assignment-preflight denial, mid-year eligibility loss, substitute rejection, or offline replay rejection test (H09) |
| Nepal education-policy history | Report-card history and grading tests exist | No frozen grading-policy version or regression proving a policy edit cannot change an issued PDF's subject grades (H11) |
| Nepal HR/statutory policy | Contract/payroll readiness and Decimal calculation tests exist | No jurisdiction/school/post policy version, approved PF/TDS rate evidence, historical rate replay, or statutory-readiness denial (H10) |
| Backup/restore | `05f53d8d` local PostgreSQL restore and synthetic file recovery passed; all 273 table digests matched | Cloud/staging recovery, production volumes and RTO/RPO unverified |
| Web accessibility/visual | 33 essential Chromium checks passed at `05f53d8d`; source contracts exist | No complete keyboard/screen-reader/responsive visual certification |
| Flutter accessibility/device | Semantic action test repaired; `05f53d8d` ran 808 tests including ten same-host goldens | Real Android/iOS biometrics, secure storage and background behavior unverified |

## HIGH / CRITICAL Findings

No CRITICAL cross-tenant exploit was confirmed. Findings below distinguish source/control-flow proof from live exploitation. Known future-slice security defects do not authorize implementing Phase 1 now.

### H01 — Implicit future permission inheritance

- **Problem:** Admin uses all-except tenant permissions; Principal accounting reads/report keys are catalog-derived despite an “explicit allowlist” comment.
- **Evidence:** `packages/core/src/permissions/roles.ts` (TENANT_PERMISSION_KEYS, ADMIN_EXCLUDED_FINANCE_KEYS, PRINCIPAL_ACCOUNTING_READ_KEYS); full role CSV.
- **Failure scenario / proof:** Add a new non-finance tenant permission to the catalog and Admin's preset automatically contains it; new accounting read/report keys flow to Principal without an explicit role-list edit. This follows directly from the filters; no wildcard string is necessary.
- **Severity:** HIGH (privilege governance).
- **Current behavior:** Broad future inheritance; Platform keys explicitly excluded; finance exclusion retained.
- **Required future behavior:** Reviewed explicit allowlists and effective-alias tests for each built-in role.
- **Owning implementation slice:** Phase 1A.1 Built-In Role Allowlists / 1A.2 Role Template Baseline.
- **Blocking Phase 0? NO:** Confirmed and assigned future work; not the reason to implement migration during 0A.

### H02 — Generic school scope is lost during effective grant resolution

- **Problem:** School `UserRole.scopeId` is not propagated into effective role/permission output.
- **Evidence:** `auth/authz-cache.service.ts` resolve/load; `schema/auth.prisma` UserRole; executable `probe-authorization.cjs`.
- **Failure scenario / proof:** Synthetic grant with `scopeId='section-only'` resolves to flat students:read with no scope. A permission-only consumer cannot distinguish it from tenant-wide authority. This does not bypass the separate TeacherScopeService/guardian checks.
- **Severity:** HIGH (scoped role authority ambiguity).
- **Current behavior:** Expiry/revocation and PLATFORM global scope are checked; school scope flattening remains.
- **Required future behavior:** Typed validated scope grants and policy-aware consumers with safe legacy migration.
- **Owning implementation slice:** Phase 1C / 1D.
- **Blocking Phase 0? NO:** Known, proven contract limitation; no live cross-tenant exploit claimed.

### H03 — General student profile is not a least-privilege sensitive projection

- **Problem:** students:read plus teacher class assignment can yield identity, guardian restrictions, medical/doctor fields and financial sections without distinct sensitive-field capabilities.
- **Evidence:** StudentsController.getStudentProfile; StudentsService.getStudentProfile (tenant/teacher check then response mapping); student-profile-sanitizer only strips raw storage fields.
- **Failure scenario / proof:** An assigned Teacher with its built-in students:read calls `GET /api/v1/students/:id`; service permits assignment and emits the general non-support profile. Source mapping gates medical/restriction fields on support override, not a medical/finance capability. This is source proof, not a live seeded PHI disclosure test.
- **Severity:** HIGH (within-tenant protected data).
- **Current behavior:** Assignment/tenant protection exists; support-specific redaction exists; broad ordinary-school profile remains.
- **Required future behavior:** Server-authorized per-section/per-field projections with minimal teacher and guardian views.
- **Owning implementation slice:** Phase 3B Sensitive Projection Contract and 5F Student 360 Backend Projection, with Phase 2 policy prerequisites.
- **Blocking Phase 0? NO:** Confirmed, documented future authorization/projection work; does block a claim of least-privilege release readiness.

### H04 — Queued generic report export uses stale actor authority

- **Problem:** Worker reuses serialized actor.permissions/roles instead of current user/session/grants.
- **Evidence:** ReportsProcessor.process; ReportsService.completeQueuedExport; executable synthetic probe reaches executor using stale actor without an auth reload.
- **Failure scenario / proof:** Authorized actor queues an export; role is revoked or account suspended before execution while tenant remains active; worker can still execute using old payload grants. Probe stops before artifact writes; real queue timing was not exercised.
- **Severity:** HIGH (revocation/protected export).
- **Current behavior:** Tenant liveness and teacher assignment checks exist; generic non-teacher grant revocation is not reloaded.
- **Required future behavior:** Re-resolve current actor authority/scope at execution and before protected download; preserve an audit snapshot separately.
- **Owning implementation slice:** Phase 9F Export Authorization, built on Phase 1B/1D and Phase 2 policies.
- **Blocking Phase 0? NO:** Confirmed and assigned; no Phase 1 work performed.

### H05 — Generic notice file access omits notice audience/publication

- **Problem:** Non-OWNER notice/notice-delivery assets are granted on notices:read alone in generic file authorization.
- **Evidence:** FileRegistryController signed-preview/download/preview routes; FileRegistryService.assertFileAccessForAuth; default visibility PRIVATE; executable synthetic probe with linked unreadable-notice identifier is accepted without notice lookup.
- **Failure scenario / proof:** A same-tenant Parent knows an uploaded notice attachment asset ID for an unpublished or differently targeted notice and invokes the generic file route. Asset tenant and uploaded status pass; notices:read passes; source audience/publication is not checked. Asset-ID possession is required; no cross-tenant claim.
- **Severity:** HIGH (within-tenant protected attachment).
- **Current behavior:** Foreign tenant/support access denied; other module-specific policies exist; generic notice branch is broader than source visibility.
- **Required future behavior:** Resolve the linked notice and require current recipient/audience/lifecycle access for every generic read/sign operation.
- **Owning implementation slice:** Phase 9H Notices / 9F protected delivery, coordinated with Phase 5F file projection.
- **Blocking Phase 0? NO:** Source/control-flow proof recorded; feature hardening deferred as instructed.

### H06 — Backup rehearsal could recreate its source database (fixed)

- **Problem:** The rehearsal previously called `ensureRestoreDatabase` without the source-versus-target safety guard used by the normal restore entry point.
- **Evidence:** Previous source at `c3e6280:scripts/rehearse-backup-restore-local.mjs`; repaired entry point at `cef2d658`; `apps/web/test/backup-restore-safety.test.mjs`; final-SHA `backup-restore-result.json`, `restore-all-table-digests.json`, and `restore-file-digest.json` in the locked continuation package.
- **Failure scenario / proof:** Setting `RESTORE_DATABASE_URL` equal to `DATABASE_URL` could let target recreation drop the source. This is source/control-flow proof, not a destructive run on real data. The regression uses an unreachable localhost endpoint and requires immediate explicit refusal.
- **Severity:** HIGH (recovery/data loss).
- **Current behavior:** Existing `assertSafeRestoreTarget` now runs before connection, backup, or target recreation; local rehearsal restored all 273 public-table row digests and a synthetic storage-file SHA-256.
- **Required future behavior:** Preserve the precondition and certify staging/provider recovery separately.
- **Owning implementation slice:** Phase 0 / Slice 0A bounded baseline repair; staging/provider recovery is a later production-hardening gate.
- **Blocking Phase 0? NO:** Fixed and regression-tested at `05f53d8d` in the 666-test Web suite; final-SHA restore digest proof is locked.

### H07 — Direct refund and reversal do not require the reviewed request

- **Problem:** A separate finance request/review workflow enforces a different reviewer, but privileged direct refund and reversal routes execute without requiring an approved `FinanceApprovalRequest`.
- **Evidence:** `PaymentsController.refundPayment` / `reversePayment` expose `POST /payments/:id/refund` and `POST /payments/:id/reverse` under `payments:refund` / `payments:reverse`; `FinanceService.refundPayment` and `reversePayment` validate permission, tenant, amount/state, reason and idempotency but do not resolve an approved request. `FinanceService.reviewApprovalRequest` separately rejects the requester as reviewer. The endpoint matrix records both direct and request/review paths.
- **Failure scenario / proof:** An actor with a direct refund or reversal capability invokes the direct endpoint without submitting a request to a different approver. The service proceeds through its existing tenant and financial-integrity checks without a two-person request prerequisite. This is source-path proof, not a live unauthorized payment execution.
- **Severity:** HIGH (financial separation of duties).
- **Current behavior:** Tenant isolation, idempotency and reversal lineage remain; the two-person review applies to the request workflow but is not universal across direct execution.
- **Required future behavior:** Define and enforce a role/amount/lifecycle-aware approval policy at every refund/reversal execution entry point, preserving legitimate emergency exceptions only with explicit auditable authority.
- **Owning implementation slice:** Phase 2C Finance Approval and SoD, coordinated with Phase 7 finance recovery.
- **Blocking Phase 0? NO:** The distinct direct path and approval gap are documented for the authorized later slice; no refund/SoD migration begins in 0A.

### H08 — School role administrator can grant beyond their own authority

- **Problem:** `school_config_owner` can create school roles, grant any non-Platform permission and assign a role to their own user. The reviewed path has no grant ceiling or self-escalation check.
- **Evidence:** `packages/core/src/permissions/roles.ts` gives School Configuration Owner `roles:create`, `roles:manage_permissions`, and `roles:assign`. `RolesService.createRoleInTransaction`, `assignPermissionsInTransaction` and `assignRolesInTransaction` check school domain, tenant identity and Platform exclusions, but do not compare requested school grants with the actor's effective grants or reject `dto.userId === actor.userId`. `withSchoolAuthorizationTransaction` reloads the actor's current governance permission and session but does not apply a grant ceiling.
- **Failure scenario / proof:** A configuration owner creates a tenant role, grants it `payments:refund` or another finance capability, then assigns that role to their own tenant user. Each reviewed service path accepts the respective operation subject to the ordinary tenant/session checks. This is source-path proof; no production role was modified to test it.
- **Severity:** HIGH (within-tenant privilege escalation and finance boundary).
- **Current behavior:** Platform role names and Platform permission keys are blocked, tenant and live session checks are retained, and changes are audited; non-Platform grant breadth and self-assignment remain open.
- **Required future behavior:** Enforce a server-side grant ceiling, non-delegable permission policy, protected role-template rules and self-escalation/SoD checks, with transactional negative tests.
- **Owning implementation slice:** Phase 8A–8E Access Control governance, depending on Phase 1 authorization-policy primitives.
- **Blocking Phase 0? NO:** The path is proven and assigned; Phase 0 records it without starting access-control migration.

### H09 — Assignment authority does not include current professional eligibility

- **Problem:** Assignment creation and authoritative teacher writes do not evaluate effective-dated employment or policy-required qualification/licence/eligibility. The newer governing contract separates those facts from a Teacher role and assignment.
- **Evidence:** `AcademicsService.assignTeacher` and `ensureStaff` (`apps/api/src/academics/academics.service.ts:226-291,1702-1710`) check tenant references but not Staff status or professional eligibility before creating an active assignment. `TeacherReplacementService.activate` (`apps/api/src/timetable/teacher-replacement.service.ts:143-213`) creates the replacement assignment without that preflight. `TeacherScopeService.resolveActiveStaffId` and `resolveGrant` (`apps/api/src/teacher-scope/teacher-scope.service.ts:166-176,350-430`) check active Staff and exact effective assignment/delegation scope, not employment/licence/eligibility. `StaffQualification` (`apps/api/prisma/schema/staff.prisma`) has no verification, expiry or policy link; no teaching-licence/eligibility model was found.
- **Failure scenario / proof:** A tenant can create a teacher assignment for a Staff record without an active employment/eligibility decision; if the Staff row is `ACTIVE`, a current assignment can later satisfy the reviewed attendance/marks write scope even when a policy-required licence is absent, expired or revoked. This is source-path proof, not a live school/licence case or a claim that one universal licence rule applies across Nepal.
- **Severity:** HIGH (teacher authority and academic integrity).
- **Current behavior:** Tenant, assignment dates, exact class/section/subject/component, capability, ownership and lifecycle checks remain valuable and passed; they do not establish professional eligibility.
- **Required future behavior:** Resolve applicable versioned Nepal policy, active employment and verified professional evidence at assignment/replacement preflight and at authoritative teaching write/sync; revoke affected cached/offline authority on eligibility loss while preserving historical records.
- **Owning implementation slice:** P0-N2/N3 Nepal HR/teacher foundation, Phase 5J–5M identity/evidence, Phase 2B/6 teacher policy integration.
- **Blocking Phase 0? NO:** Fully identified and assigned under Slice 0A's audit exit rule; it blocks claiming production-trustworthy Phase 6 teacher authority until implemented and negatively tested.

### H10 — Payroll statutory amounts lack approved effective-dated policy evidence

- **Problem:** Payroll line calculations use fixed PF employee/employer `0.10` and TDS `0.01` multipliers when enabled, with no approved jurisdiction/school/post policy version bound to the run.
- **Evidence:** `PayrollService.calculatePayrollLine` (`apps/api/src/payroll/payroll.service.ts:3059-3105`) contains the constants. `calculatePeriodPayrollLines` (`payroll.service.ts:1083-1258`) builds persisted lines from active salary structures/contracts and calls that calculator; `PayrollController` exposes create, approve and post routes (`apps/api/src/payroll/payroll.controller.ts:233-304`). `PayrollReadinessService` checks contract/salary source and lifecycle, but the reviewed path carries no approved statutory-rate policy reference.
- **Failure scenario / proof:** For a tenant/post/effective period whose approved statutory rule differs from those constants, an otherwise ready payroll run computes and can advance with an unsupported amount. This is source-path proof of missing policy provenance, not a claim about the legally correct current Nepal rate or a live posted run.
- **Severity:** HIGH (financial/statutory integrity).
- **Current behavior:** Decimal arithmetic, effective salary/contract selection, readiness findings, approval lifecycle and M11 posting integration exist; none proves statutory correctness.
- **Required future behavior:** Bind payroll inputs and calculation to approved, effective-dated policy/evidence for the applicable jurisdiction, school and employment/post context; retain the version with historical lines, block unsupported statutory readiness, and reconcile controlled posting to M11.
- **Owning implementation slice:** P0-N2 Nepal HR legal-policy foundation and Phase 7P–7R compensation, readiness and payroll accounting.
- **Blocking Phase 0? NO:** Confirmed and assigned for later implementation; no statutory payroll readiness is certified by this baseline.

### H11 — Current grading settings can change an issued report-card PDF

- **Problem:** Report-card PDF retrieval rebuilds subject grades from current marks and current mutable tenant grading settings while its summary uses the saved ReportCard grade/totals. No policy version is attached to the persisted report card.
- **Evidence:** `GradeCalculatorService.getTenantGradingPolicy` reads `grading_scale` and `grading_rounding_policy` on each call (`apps/api/src/academics/grade-calculator.service.ts:181-199`); `SettingsService.updateSetting` upserts those values (`apps/api/src/settings/settings.service.ts:302-348`). `ReportCardPdfService.getReportCardPdf` reads current marks/policy and builds subject rows on each request but uses saved ReportCard summary (`apps/api/src/academics/report-card-pdf.service.ts:53-113,170-228`). `ReportCard`, `ReportCardHistory` and `ReportCardSubjectResult` preserve versioned values without a grading-policy-version field (`apps/api/prisma/schema/exam.prisma:104-197`).
- **Failure scenario / proof:** Change the permitted grading scale after publication, then request the same report-card PDF: its freshly calculated subject grades can reflect the new scale while the saved final grade still reflects the earlier outcome. The source path proves the inconsistency possibility; no real student's result was changed for this audit.
- **Severity:** HIGH (academic-history integrity).
- **Current behavior:** Report-card versions/history and subject result rows are retained; tenant-bound read access remains. The PDF generation path does not use a frozen grading policy or the persisted subject-result grades for its displayed subject outcomes.
- **Required future behavior:** Version and approve effective grading policy, persist its reference/snapshot with authoritative results, and render or regenerate historical PDFs under the original version without rewriting prior records.
- **Owning implementation slice:** P0-N1 Nepal education-policy foundation and Phase 6E–6H result/report-card hardening.
- **Blocking Phase 0? NO:** Source-path gap is documented for the later policy/result slice; Slice 0A does not migrate grading behavior.

## Documentation / Repository Conflicts

1. “Explicit allowlists only” target conflicts with Admin and Principal catalog filters (H01). Blueprint target is not current implementation proof.
2. “Default deny” is not yet uniform permission-metadata behavior: school requests without metadata are allowed by RolesPermissionsGuard and may rely on service checks. Do not remove working self/relationship policies or claim a universal kernel exists.
3. Authz/Redis and entitlement comments describe cross-request authority caching or a removed `apps/api/AGENTS.md`; current implementation reads authority live. Root AGENTS is the single authority.
4. Before `f312e6b9`, root `lint` omitted API ESLint and Core/Web had no canonical formatting script. The new scripts and pinned formatter close that gate-coverage conflict; they pass at `05f53d8d`. API ESLint comments claiming warning-only test rules do not override actual strict diagnostics.
5. Prisma package seed metadata differs from effective Prisma 7 configuration. Configured school seed is not explicit Platform bootstrap.
6. Master plan section 0.2 says “four root docs,” while its coordinated set now includes five. This report uses all five and the root AGENTS partitioned authority; it does not create another master document.
7. Design playbooks describe targets, not proof that current pages meet them. No aesthetic changes were made to make documentation appear implemented.
8. Existing deferred-module code/tests do not reactivate M8/M9/M10/M13 or international scope. Legacy chat compatibility does not restore active chat.
9. The later root contract and RBAC playbook require active employment and applicable professional eligibility for teaching authority, but current Staff/assignment/TeacherScope code lacks the policy-backed evidence decision (H09). Preserve the correct assignment checks and add the missing precondition in its owning future slices.
10. The new education/HR policy roadmap describes versioned statutory and grading authority; current payroll constants and mutable grading settings are implementation evidence to the contrary (H10/H11). Blueprint-only `hr:employment`, `hr:qualification`, `hr:teaching_license`, `hr:teacher_eligibility`, `hr:compensation` and `hr:statutory_membership` keys must not be represented as live Core permissions.
11. The master plan inserts P0-N1–N4 and Phase 5J–5M before trustworthy Phase 6/7, while its recommended session list still moves from Session 12 Phase 5E–5I to Session 13 Phase 6A–6D. The dependency text controls; future session sequencing must include the omitted prerequisite slices. This is recorded here without beginning them.

## Phase 0 Exit Decision

**PHASE 0: PASS**

All local gates, the empty-database migration and seed, generated contracts, full API/Web/Flutter suites, authenticated browser smoke, production build and local database/file recovery passed on one clean implementation SHA, `05f53d8d`; the evidence package records commands and checksums. Full hosted workflows passed on that SHA and the first audit/evidence SHA `cb7544ca`, with `verify` and `mobile` executed rather than path-skipped. The five later authority-document commits changed no implementation/schema/CI bytes; H09–H11 classify their newly explicit unmet invariants with source-path proof and future owners. A fresh database/Redis browser rerun resolved the earlier audit-environment contamination. The `088054ac` full run exposed one browser assertion race despite a green workflow; that gate is not counted as a clean browser pass. Endpoint declaration coverage is broad while downstream service review remains explicitly bounded. The final delivery SHA and its clean full CI result are recorded in the delivery response because a Git commit cannot embed its own hash.

The evidence package identifies future authorization, teacher-eligibility, statutory-policy and grading-history defects without implementing them. P0-N1–N4 is a later cross-phase prerequisite before authoritative Phase 6/7 workflows, not an expansion of audit-only Slice 0A. **Exact recommended next slice: Phase 1A — Canonical Permission Catalog, including 1A.1 built-in allowlists and 1A.2 role template baseline.** Phase 1 was not begun in Slice 0A.
