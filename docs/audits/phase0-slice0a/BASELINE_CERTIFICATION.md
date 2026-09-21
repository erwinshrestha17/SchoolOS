# SchoolOS Phase 0 Baseline Certification

Date: 2026-09-21. Scope: **Phase 0 / Slice 0A only**. This is a point-in-time audit and verification record, not another repository-wide source of truth. `AGENTS.md` and its recognized execution documents retain their authority. No Phase 1 authorization migration or product redesign was performed.

## Repository Baseline

- Repository: `https://github.com/erwinshrestha17/SchoolOS`, local `/Users/erwin/Projects/SchoolOS`.
- Branch: `main`; no feature branch. The master plan explicitly permits main with coherent commit boundaries.
- Starting SHA: `6240ed7fc62c65a7d10f3fb851a775db8ebefe2a`. Initial tree clean. `git fetch origin` and `git merge --ff-only origin/main` reported already up to date.
- Final implementation SHA / audit target: `3aa8d07cf5a2945bab7f353f0e3ac0620cc2d09c` (includes repair commit `a77aac8436a575c9b0279a97e4ce2d01bb20c694`). The subsequent evidence-only commit contains this report; its hash is reported in the delivery response. This distinction avoids pretending a report can contain its own Git commit hash.
- No push, hosted rerun, merge, deployment, real provider transaction, or physical-device certification is claimed.
- Raw execution evidence was captured under `/tmp/schoolos-slice0a-evidence`; selected full logs, checksums, and reproduction instructions are preserved alongside this report. Preliminary runs on a dirty tree are explicitly distinguished from final-target reruns in the JSONL manifests.

| Tool | Observed version / boundary |
| --- | --- |
| Host Node | 24.15.0 initially |
| Verification Node | 22.23.2, selected explicitly to match CI major 22 |
| pnpm | 10.12.1; packageManager and lockfile unchanged |
| Prisma client / CLI | 7.8.0 |
| PostgreSQL | 16.13, cached `postgres:16-alpine`, isolated loopback port 55433; hosted starting run used 16.15 |
| Redis | 7.4.8, isolated loopback port 56379; hosted starting run used 7.4.11 |
| Flutter | 3.44.0, framework 559ffa3f75, macOS arm64; matches CI Flutter version |
| Dart | 3.12.0 |

The audit used new disposable PostgreSQL/Redis containers, not the development school database. Additional explicitly opted-in databases were `schoolos_auth_recovery_test` and `schoolos_admission_atomic_test`. A second empty database, `schoolos_baseline_final`, replayed the final target's canonical migration and seed commands. During that replay the audit containers had stopped with exit 0 (not OOM); the initial connection failures were preserved and the commands rerun after restarting only those audit containers.

### Canonical commands and configuration

These were read from root/workspace package scripts, Prisma config, Playwright config, and `.github/workflows/ci.yml`, rather than inferred from roadmap prose.

| Concern | Canonical command / important distinction |
| --- | --- |
| Install | `pnpm install --frozen-lockfile`; mobile `flutter pub get` |
| API format | `pnpm --filter @schoolos/api format:check`; CI historically writes then checks Git diff |
| Core/Web format | No canonical format script; supplementary Prettier checks recorded below, without bulk reformatting |
| Root lint | `pnpm lint`: artifact/import checks, API **formatting**, Web ESLint; does **not** run API ESLint |
| API lint | `pnpm --filter @schoolos/api lint:check`; do not use mutating `lint` for certification |
| Core lint | `pnpm --filter @schoolos/core lint` (TypeScript no-emit) |
| Typecheck | `pnpm typecheck`, ordered core build → API → Web |
| Prisma | `pnpm db:generate`; `pnpm db:validate` |
| Generated contracts | `pnpm compile:artifacts`; `pnpm verify:tracked-artifacts`; `pnpm verify:openapi`; `pnpm check:core-imports`; `pnpm check:core-dist` |
| Unit/component | `pnpm test`: API Jest + Web Node test runner. Core `test` is an explicit no-tests placeholder |
| API E2E | `pnpm test:e2e`; Nest HTTP tests include mocked persistence/providers; not a substitute for PostgreSQL integration |
| Integration | `pnpm test:integration`; auth/admission concurrency suites additionally require explicit guarded test-database URLs |
| Migration | `pnpm db:migrate` adds QR preflight before `prisma migrate deploy`; CI uses direct deploy |
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
8. Add manual full workflow dispatch to bypass path skipping and provision the two guarded concurrency databases in CI. Hosted execution of these changes remains unverified.

No role presets, permissions, domain authorization, lifecycle rules, financial logic, schema, migrations, application layout, snapshots, or quality thresholds were changed.

## Verification Results

Results refer to final implementation source unless explicitly marked preliminary. Logs and command/exit manifests are in [evidence/](evidence/README.md); `.log` names below are stored as `.log.gz`. A zero exit with skipped tests is not a full pass.

| Gate | Result | Evidence |
| --- | --- | --- |
| Frozen install, Node 22 | PASS | `final-install22.log` |
| Compile generated artifacts / tracked artifacts | PASS | `final-generate.log`, `final-tracked.log`; no tracked generated drift |
| Prisma generate / validate | PASS | `final-generate.log`, `final-validate.log`, Prisma 7.8.0 |
| Core lint / typecheck / build / import boundaries / dist | PASS | `final-core-lint.log`, `final-typecheck.log`, `final-lint.log`, `final-openapi.log` |
| Core standalone tests | NOT APPLICABLE | Package script explicitly contains no tests; shared behavior exercised by API/Web tests, not claimed as a core suite |
| Core supplementary formatting | FAIL | `core-format.log`: 38 files; no canonical core format script |
| OpenAPI gate | PASS | 1,152 paths, 1,334 operations, 475 schemas; `final-openapi.log` |
| API formatting | PASS | Root lint includes API format check; `final-lint.log` |
| API ESLint | FAIL | `final-api-eslint.log`: 1,750 errors, 8,614 warnings; not covered by root lint |
| API typecheck | PASS | `final-typecheck.log` after fixture repairs |
| API unit tests | PASS | `final-unit.log`: 272 suites, 3,110 tests |
| API HTTP E2E | PASS | `final-api-e2e.log`: 43 suites, 294 tests |
| PostgreSQL integration, all opt-ins enabled | PASS | `final-integration.log`: 12 suites, 202 tests; earlier 112 skips and four fixture failures separately retained |
| Empty supported DB migration | PASS | 112 migrations, `final-empty-migration-retry.log`; initial stopped-container attempt recorded separately |
| Canonical seed on empty migrated DB | PASS | `final-seed-retry.log`; no migration resolve/manual SQL repair required |
| Migration history status | PASS | `final-migration-status.log`; migration source hashes in `migrations.json` |
| Migrated DB ↔ schema drift | FAIL | `migration-diff.log`: nonempty default/index-name drift; do not apply generated SQL blindly |
| API production artifact build | PASS | `final-build.log`; compiled API also started and returned health `status: ok` on isolated port 4400 |
| Web lint / typecheck | PASS | `final-lint.log`, `final-typecheck.log` |
| Web supplementary formatting | FAIL | `web-format.log`: 682 files; no canonical Web format script |
| Web unit/component contracts | PASS | `final-unit.log`: 665 tests after documentation assertion repair; many are source-contract tests, not rendered component tests |
| Web production build | PASS | `final-build.log`; 262 static pages; Node 22, explicit production build mode |
| Chromium install | PASS | `chromium.log` |
| Essential Playwright smoke | FAIL | `web-e2e.log`: 8 passed, 14 failed, 5 skipped, 6 did not run; no browser-green claim |
| Flutter dependency resolution / format / analyze | PASS | `flutter-pub.log`, `flutter-format.log`, `flutter-analyze-repair.log` |
| Flutter tests including goldens | FAIL | `flutter-full-repair.log`: 798 passed, 10 golden failures. Non-golden fixture defects repaired |
| Physical Android/iOS, provider delivery, backup restoration | BLOCKED | Not established by local source/unit/browser evidence; required external/device/recovery evidence remains absent |
| Hosted CI on final implementation SHA | BLOCKED | Only starting SHA has a fetched hosted run. Repairs and full-dispatch configuration are local commits |
| One clean, fully green, final-SHA certification | BLOCKED | Failing gates above; evidence-only commit distinct from implementation SHA; no PASS asserted |

### Remaining baseline failures explained

- **API ESLint:** repository-wide pre-existing diagnostics, chiefly unsafe TypeScript usage and related lint rules. Root `lint` does not execute this gate. A broad automatic fix or rule disable would violate this task's bounded repair policy.
- **Core/Web formatting:** supplementary checks use the installed formatter; there is no agreed package script/configuration enforcing the entire surfaces. These findings are not silently reclassified as PASS or bulk rewritten.
- **Schema drift:** replay succeeds, but Prisma diff proposes dropping defaults on `ReceiptSequence.updatedAt` and `StudentGuardian.updatedAt` and renaming indexes whose migration names differ from schema-generated names. SQL-only partial/NULLS-NOT-DISTINCT constraints must be preserved. This is model/migration representation drift, not a failed migration or proof that data were corrupted.
- **Flutter:** all remaining failures are existing golden comparisons (Parent dashboard variants, children, homework filter, timetable), with differences of 0.12–0.33%. The filter-sheet master/test/masked images were visually inspected: layout matches with text-raster differences. That observation does not establish the cause of every failing image or justify regenerating the baselines. No golden was updated, threshold widened, or test excluded.
- **Browser:** the full run reached real SchoolOS public/login/dashboard pages. Failures include Users & access heading, removed-chat heading, authenticated navigation, and Platform login. API logs show 429 on `/auth/me` with the default five-per-minute auth policy; ordinary school seed also does not bootstrap an explicit Platform operator. These are fixture/rate-policy/presentation verification issues, not proof that Platform isolation is broken. Retained error contexts distinguish assertions from login timeouts. The admin-reset scenario and several later tests did not execute, so they remain unverified.

## Implementation Classification

“Correctly implemented” below applies to the named bounded mechanism and supporting tests, not whole-module release readiness.

| Capability | Status | Evidence | Next Action |
| --- | --- | --- | --- |
| Nest API/domain organization | correctly implemented | Controllers/services/modules in `apps/api`; successful compile + 3,110 unit/294 HTTP tests | Preserve architecture |
| Prisma top-level tenant enforcement | correctly implemented | `prisma.service.ts` rejects missing context, overwrites client tenant predicates, rejects unsupported operations; tenant-isolation integration | Preserve; audit nested writes/raw SQL separately |
| Authentication revocation/rotation | correctly implemented | Live JwtAuthGuard session-family/user checks; authVersion transactions; auth concurrency integration | Preserve; device/offline boundary testing |
| Teacher scope engine | correctly implemented | `teacher-scope.service.ts`, capability rules, Attendance/Marks callers, scope unit/E2E/integration suites | Adapt behind later kernel; do not replace |
| Guardian capability engine | correctly implemented | `parent-scope.ts`, ParentScopeContextService, guardian integration and child-denial tests | Preserve; complete call-site/projection coverage |
| Platform domain/support boundary | correctly implemented | PlatformGuard, explicit global grants, purpose/expiry/read-only support allowlist | Preserve; fixture/hosted verification |
| Permission catalog/aliases | partially implemented | Core catalog, alias map, role snapshot; mixed two/three-part vocabulary | Phase 1A |
| Role templates | conflicting | Admin all-except and Principal accounting catalog filter conflict with explicit-allowlist target | H01 / Phase 1A.1–1A.2 |
| Typed school role scopes | missing | UserRole.scopeId is generic; AuthzCacheService discards school scope from effective grants | H02 / Phase 1C–1D |
| Central decision kernel | documentation-only | Blueprint target; current guards/domain services already implement substantial enforcement | Phase 1B after baseline; wrap existing mechanisms |
| Student protected-data projection | unsafe | General profile returns medical/restriction/identity and financial sections; only support is explicitly redacted | H03 / Phase 3B, 5F |
| Staff protected-data projection | partially implemented | Staff serializer drops raw User; masks bank/identity/salary without HR/payroll grant | Review broad hr:manage semantics in Phase 2D/3B/7H |
| Finance and payroll SoD | partially implemented | Manual journal creator cannot approve; Accountant combines many capabilities; HR prepares/reviews | Phase 2C/2D; retain current checks |
| Receipt/payment/ledger integrity | partially implemented | Decimal storage, sequences, unique provider/idempotency keys, reversal lineage, finance tests | Full concurrent recovery/restore evidence still required |
| Reports/queued exports | unsafe | Teacher scope exists; queued generic export uses stale actor snapshot | H04 / Phase 9F with Phase 1/2 policy dependencies |
| Protected files | partially implemented | Tenant, upload status, owner/module checks, signed TTL and support prohibition | H05; audit generic notice audience/lifecycle |
| M12 notification delivery | partially implemented | Persisted events/deliveries, retries, current recipient/source checks, stale-attempt tests | Provider/failure/recovery verification; preserve M15/M12 split |
| Redis authorization behavior | correctly implemented | Role and entitlement resolution now read live; request memo only; compatibility cache invalidation remains | Correct stale comments, retain live authority |
| Web shell/state/primitives | partially implemented | Shared session provider, query cache teardown, shell/navigation and UI primitives; source tests pass | Browser baseline before redesign; retain existing primitive families |
| Mobile shell/auth/cache/drafts | partially implemented | Riverpod/GoRouter/Dio/secure storage, scoped private cache, biometrics and sync envelope | Golden/device/offline revocation verification |
| Learning/deferred services | partially implemented | Existing code/tests remain despite active scope freeze | Keep isolated; do not activate or delete merely for audit |
| Broad future kernel/JIT/typed grant roadmap | documentation-only | Execution blueprints describe future state | Do not claim implemented |
| Cloud storage, real delivery, backup recovery, device biometrics | external dependency | Adapters/scripts exist; no live provider/physical-device/recovery run in this audit | Separate controlled evidence |

### Architecture and design primitive inventory

- `packages/core`: permission catalog/aliases/presets, API contracts, entitlements, date/localization; build consumed by API and Web. Core standalone test script has no suite.
- `apps/api/prisma/schema/*.prisma`: canonical split inputs; `schema.prisma` is compiled. 112 immutable migration files inventoried with SHA-256. Prisma 7 adapter uses PostgreSQL.
- `apps/web`: Next App Router, React Query, session provider; shared shell and persona navigation, components under `components/ui`, module workspaces, dashboard primitives. Existing `card`, `section-card`, `summary-card`, `operational-summary`, `data-table`, `workspace-states`, drawer/dialog/form components coexist. This is an inventory, not evidence that a third design system is needed. Browser failure blocks visual certification.
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

## Endpoint → Authorization Matrix

- [endpoint-declarations.csv](endpoint-declarations.csv): AST-derived inventory of **1,336 method declarations across 111 controller files**, including inherited/method permissions, guards, entitlement markers, support scopes and service calls. This is not a claim of 1,336 deployed operations: OpenAPI reports 1,334 operations; declaration inventory includes routes outside its exposed contract.
- [endpoint-authorization-reviewed.csv](endpoint-authorization-reviewed.csv): **35 selected sensitive operations** with route/controller, permission, entitlement, tenant/resource/relationship scope, lifecycle, SoD, downstream evidence and known gap.
- Downstream families inspected include authentication, students, Parent child scope, Teacher attendance/marks, roles, payroll/manual journal, reports/exports, files, queues and Platform support. Unreviewed declaration rows are explicitly labeled inventory-only. This is not exhaustive service-path security certification; do not promote it to one.

Cross-cutting facts: JwtAuthGuard derives effective tenant from verified identity; Prisma enforces top-level tenant operations; school routes with RolesPermissionsGuard use required permission **AND** semantics with aliases. `RolesPermissionsGuard` returns true for SCHOOL requests with no role/permission metadata; some such routes implement self-service or module checks inside services. It is therefore not a universal “missing permission metadata always denies” kernel. EntitlementGuard fails missing entitlement declarations closed where installed. PlatformGuard has a separate domain/role/permission path. Guard presence alone does not prove row or field scope.

## Persona → Scope Matrix

| Persona | Current resource boundary | Evidence / limitation |
| --- | --- | --- |
| Parent | Authenticated tenant/user → active, VERIFIED, APPROVED, effective guardian link → capability → exact child | `parent-scope.ts`, ParentScopeContextService, MobileService; denied child is not substituted |
| Teacher | Active Staff → tenant/year/class/section/subject/component → assignment/delegation capability; ownership/lifecycle where required | TeacherScopeService and Marks/Attendance; retain legacy any-section adapter only where record lacks section |
| Principal | Tenant oversight plus explicit approvals, lifecycle/domain policy | Preset is not universal write authority; dynamic accounting subset still needs 1A |
| Admin | Tenant operational permissions excluding finance roots | All-except future inheritance; not Platform; no typed grant scope in effective role projection |
| HR | Tenant staff/leave/payroll preparation; sensitive serializer controlled by HR/payroll permissions | Broad hr:manage allows sensitive data; full preparation/review/approval separation incomplete |
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
| Rate policy | AppThrottlerGuard applies auth limit to `/auth/me` as well as login. Rapid browser navigation produced 429; do not disable security controls to obtain green tests |

## Prisma/Data Integrity Findings

- All 112 migration files replayed from empty PostgreSQL 16, with no `migrate resolve`, history rewriting or data repair. The canonical seed ran. A nonempty schema diff is retained as a separate FAIL, not confused with replay success.
- User email/phone and role names are tenant-unique. UserRole contains tenantId, generic scopeId, assigned/revoked metadata and expiresAt; it has user/role FKs and a composite grant key. It has no typed scope model. Nullable grant keys and missing composite tenant FKs deserve evidence-led Phase 1C/1D review, not speculative constraints now.
- StudentGuardian has unique student/guardian pairs, active/verification/approval/effective-date/capability columns and indexes. SQL migration adds a partial unique active-primary guardian index and capability/window checks. This is more than a bare join table.
- TeacherAssignment exact scope uniqueness is recreated with `NULLS NOT DISTINCT` by the latest migration; migrations preflight duplicates. Indexed tenant/staff/year/status and class/section lookups exist. Exact tuple uniqueness is not a general exclusion constraint for all overlapping delegation/effective-date combinations.
- Enrollment preserves effective dates and lifecycle; a SQL partial unique active-enrollment constraint exists. Service transitions and historical roster/version handling must remain authoritative.
- M3/M7/M11 authoritative amounts use Prisma Decimal columns. Payment/refund idempotency keys are tenant-composite; provider-reference uniqueness and tenant receipt/refund identifiers exist; ReceiptSequence provides atomic sequence state. Float-like presentation conversions are not evidence that persisted amounts use floating point.
- Journal/reversal/source mapping/posting history, payment refund lineage, payroll state and receipt reprint history exist. Application-level immutable lifecycle protection is not the same as a DB-wide immutable-table guarantee.
- `approvePayrollRun` performs line, payslip and run writes without one visible encompassing transaction; future failure-injection/atomicity review belongs to Phase 2D/7J. This audit does not claim a reproduced financial inconsistency.
- Many entity FKs are ID-only with separate tenant columns. The top-level Prisma extension cannot prove nested cross-tenant consistency; targeted mixed-tenant insertion tests remain important before typed-scope migration.

## Offline/Queue/Cache/File Findings

- Web has tenant/user scoped drafts, read cache, outbox, authority fence, and an eight-hour bounded offline-auth lease. Platform leases fail closed. Session teardown clears React Query, support state, recent items, lease/fence, attendance drafts, outbox, module drafts and read cache. Offline unsafe HTTP methods are rejected; cached permission lists are not accepted as server authority.
- Mobile private cache uses secure storage, tenant/user/role namespace, resource allowlist, byte quotas, TTL, protected-material filtering and optional authorization-scope version. Credential epochs fence late writes during logout/login. Auth failure/private cleanup and wrong-child tests exist.
- Attendance sync carries durable client submission/operation identity, roster and authorization versions; server recalculates current authority and returns explicit conflicts. Homework/marks draft stores and authority discovery code also exist; a draft store is not permission to publish/results/payments offline. All high-risk server transitions remain online-only in this audit's reviewed paths.
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
| HIGH | Teacher/guardian/Platform negatives, protected files, route denial, tenant integration | Only 35 endpoint operations have explicit downstream matrix review; remaining sensitive paths need review; typed scopes and field projections incomplete |
| CRITICAL | Auth recovery/admin concurrency, attendance correction concurrency, admission atomicity, finance replay/reversal tests | Not a full database-concurrency/failure-injection/restore program for every financial transition |
| Cross-tenant / negative auth | Dedicated API integration/E2E suites passed | Nested relations, mixed bulk IDs and every export/worker subtype not exhaustively tested |
| Idempotency/replay | Refresh, attendance, finance and notification stale-attempt coverage | Real provider duplicates, DB commit/queue outage and dead-letter recovery across all families |
| Migration | 112-file empty replay, guarded migration probe, schema diff | Supported production upgrade/dirty-data preflights and drift reconciliation |
| Financial reversal | Journal/payment/payroll lineage tests present | Live PostgreSQL competing-actor rollback/reversal and end-to-end recovery evidence |
| Offline/sync | Scope/version/conflict/cache tests | Actual device offline revocation, year change, app resume, prolonged disconnection |
| Backup/restore | Scripts exist | No backup restored and reconciled in this slice |
| Web accessibility/visual | Playwright + source checks exist | Failing authenticated smoke; no complete keyboard/screen-reader/responsive visual certification |
| Flutter accessibility/device | Semantic action test repaired; widget/text-scale tests pass | 10 goldens fail; real Android/iOS biometrics, secure storage and background behavior unverified |

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

## Documentation / Repository Conflicts

1. “Explicit allowlists only” target conflicts with Admin and Principal catalog filters (H01). Blueprint target is not current implementation proof.
2. “Default deny” is not yet uniform permission-metadata behavior: school requests without metadata are allowed by RolesPermissionsGuard and may rely on service checks. Do not remove working self/relationship policies or claim a universal kernel exists.
3. Authz/Redis and entitlement comments describe cross-request authority caching or a removed `apps/api/AGENTS.md`; current implementation reads authority live. Root AGENTS is the single authority.
4. Root `lint` naming hides the absence of API ESLint; core/Web have no canonical formatting script. Full baseline must state these differences.
5. Prisma package seed metadata differs from effective Prisma 7 configuration. Configured school seed is not explicit Platform bootstrap.
6. Master plan section 0.2 says “four root docs,” while its coordinated set now includes five. This report uses all five and the root AGENTS partitioned authority; it does not create another master document.
7. Design playbooks describe targets, not proof that current pages meet them. No aesthetic changes were made to make documentation appear implemented.
8. Existing deferred-module code/tests do not reactivate M8/M9/M10/M13 or international scope. Legacy chat compatibility does not restore active chat.

## Phase 0 Exit Decision

**PHASE 0: BLOCKED**

Migration replay, generated contracts, unit/HTTP/integration checks and production build provide useful evidence, but they do not override API ESLint failures, supplementary format failures, schema representation drift, ten golden failures and a failing/skipping authenticated browser suite. Hosted CI has not run the final implementation SHA. Endpoint declaration coverage is broad, while downstream service review remains explicitly bounded. No fully green final-SHA certificate is issued.

The evidence package identifies future authorization defects without implementing them. **Exact next slice: continue Phase 0 / Slice 0A — close the remaining baseline gate and evidence gaps.** Once that slice passes, the master plan's next implementation slice is **Phase 1A — Canonical Permission Catalog, including 1A.1 built-in allowlists and 1A.2 role template baseline**. Do not start it from this BLOCKED state.
