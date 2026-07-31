# P0-01 Authorization, Tenant Isolation and Scope Enforcement (2026-07-31, local)

Status: **PARTIAL (local development complete for this hardening slice; not staging / controlled-pilot validated)**

Scope: Close remaining P0-01 gaps around capability contract completeness, `RESULT_REVIEW` assignment enforcement, authorization denial audit vocabulary, background-job missing-tenant fail-closed proof, mobile access-changed cache invalidation, and a static authorization matrix contract.

## Implementation completed in this slice

- Added `TeacherCapability.RESULT_REVIEW` and wired `ResultsService` teacher previews through `TeacherScopeService` instead of a class/section combo list alone.
- Documented P0-01 required capability aliases onto existing enforcement surfaces (`SUBJECT_HOMEWORK_WRITE` → `SUBJECT_HOMEWORK_CREATE`, `SUBJECT_MARKS_WRITE` → `MARKS_ENTER`, `CLASS_ACADEMIC_OVERVIEW` → `HOMEROOM_ACADEMIC_SUMMARY_READ`, `CLASS_TEACHER_REMARK_WRITE` → `CLASS_TEACHER_REMARK`; publish/unlock/guardian-manage/file remain RBAC / FileRegistry).
- Added `authorization-audit` helpers and wired guardian capability denials in attendance and student-QR paths.
- Extended `runTenantScopedJob` missing-tenant fail-closed unit coverage.
- Mobile: access-changed permission codes clear private caches; parent controller prunes unlinked child caches; teacher attendance discards unauthorized queued drafts; parent UI shows controlled access-changed state.

## Migrations

None. No Prisma schema change was required for this slice.

## Commands run and results

| Check | Result | Detail |
|---|---|---|
| `pnpm db:validate` | PASS | Prisma schema valid |
| `pnpm verify:openapi` | PASS | OpenAPI gate passed |
| Focused API unit/contract suites (7) | PASS | 71/71 |
| `test/teacher-scope-authorization.e2e-spec.ts` | PASS | 17/17 |
| `pnpm --filter @schoolos/api typecheck` | PASS | |
| `pnpm --filter @schoolos/web typecheck` | PASS | |
| Flutter focused tests | PASS | 11/11 (`parent_controller_test`, `private_data_cleanup_service_test`) |

```bash
pnpm db:validate
pnpm verify:openapi
pnpm --filter @schoolos/api exec jest \
  src/teacher-scope/p0-01-capability-contract.spec.ts \
  src/common/security/p0-01-authorization-matrix.contract.spec.ts \
  src/common/security/authorization-audit.spec.ts \
  src/common/security/parent-scope.spec.ts \
  src/plans/processor-tenant.context.spec.ts \
  src/academics/results.service.spec.ts \
  src/teacher-scope/teacher-scope.service.spec.ts \
  --runInBand
pnpm --filter @schoolos/api exec jest --config ./test/jest-e2e.json \
  test/teacher-scope-authorization.e2e-spec.ts --runInBand
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/web typecheck
cd apps/schoolos_mobile && flutter test \
  test/parent_controller_test.dart \
  test/private_data_cleanup_service_test.dart
```

## Follow-up slice — tenant-scope sweep of `findUnique`-by-id (2026-07-31)

A systematic sweep of all non-spec API sources for `prisma.<model>.findUnique({ where: { id } })`
on tenant-owned models produced 11 candidates after excluding global/reference models
(`tenant`, `user`, `nepal*`, `plan`).

Ten were confirmed safe on inspection — the id was already tenant-validated upstream
(`roles.service.ts:146`, `attendance.service.ts:919`, `students.service.ts:2709`,
`homework.service.ts:150`), the tenant was compared explicitly after the read
(`timetable-conflict.service.ts:265` → line 302), or the `where` used shorthand
`tenantId` the first-pass regex missed (`accounting-reports.service.ts`).

**Correction to an earlier note in this slice.** The `exportRoster` item below was first recorded as
a live cross-tenant leak. That was wrong, and the corrected assessment is used from here on:
`PrismaService` wraps every model in a `$extends` query extension (`applyTenantScopeToArgs`) that
injects `tenantId` from CLS into `findUnique`/`findFirst`/`findMany`/`update`/`delete`/`count`.
`Class` and `Section` are **not** in `TENANT_SCOPE_EXCLUDED_MODELS`, so those lookups were already
tenant-scoped at runtime on any request with CLS populated. The change is worthwhile
defence-in-depth, not a vulnerability fix.

| Item | Detail |
|---|---|
| Location | `apps/api/src/students/students.service.ts:3940-3948` (`exportRoster`) |
| Finding | Roster PDF header resolved client-supplied `classId`/`sectionId` without *explicit* tenant scope, relying entirely on the implicit CLS extension |
| Severity | **Defence-in-depth (not a live leak)** — auto-scoping covers it today; explicit scoping removes the dependency on an implicit proxy |
| Fix | `findUnique` → `findFirst` with `tenantId: actor.tenantId` |
| Regression test | `students.service.spec.ts` — *"scopes roster PDF class/section header lookups to the actor tenant"* |

### Real defect found and fixed — API-key requests bypassed tenant scoping

| Item | Detail |
|---|---|
| Location | `apps/api/src/auth/guards/api-key-auth.guard.ts` |
| Defect | The guard populated `request.auth.tenantId` but never injected `ClsService` and never called `cls.set(TENANT_ID_KEY, …)` — unlike `JwtAuthGuard`, which does (`jwt-auth.guard.ts:168`) |
| Impact | `applyTenantScopeToArgs` returns args **unchanged** when `tenantId` is falsy. Every Prisma query served under API-key auth would therefore execute with **no tenant filter at all**, across all 239 tenant-owned models — a fail-**open** default |
| Severity | **Latent, not currently live.** `ApiKeyAuthGuard` is registered in `auth.module.ts` but is not attached to any controller or route today, so blast radius is presently zero. It becomes a full cross-tenant read/write breach the moment any route adds `@UseGuards(ApiKeyAuthGuard)` |
| Root cause | Tenant isolation depends on a CLS side effect that each authentication guard must remember to perform; nothing structurally enforces it. The second auth path simply never did |
| Fix | Inject `ClsService`, mirror the `JwtAuthGuard` `isActive()` check, bind `TENANT_ID_KEY` to the validated key's tenant |
| Regression tests | `api-key-auth.guard.spec.ts` — *"binds the tenant into CLS so Prisma tenant scoping applies"* and *"does not attempt to bind the tenant when no CLS context is active"* |

### Structural fix — tenant scoping converted from fail-open to fail-closed (owner-approved)

Previously `applyTenantScopeToArgs` returned args **unscoped** whenever CLS `tenantId` was absent,
so any entry point that forgot the CLS write silently disabled tenant isolation everywhere — exactly
how the API-key guard defect arose. The extension now **throws `MissingTenantScopeError`** when a
tenant-scoped model is read or written with no tenant context, satisfying the P0-01 requirement that
missing tenant context fails closed.

Two explicit, greppable escape hatches were added to `PrismaService` (both surfaced through the
Proxy allowlist, or they would be shadowed by the extended client):

| Helper | Purpose |
|---|---|
| `runWithTenantScope(tenantId, fn)` | Runs a region **scoped to one tenant**, exactly as an authenticated request would be. Preferred for per-tenant loops in scheduled jobs |
| `runWithoutTenantScope(reason, fn)` | Suspends the check for genuinely cross-tenant work. A non-empty `reason` is **required and enforced**, so every bypass documents itself at the call site. Restores the previous flag on exit, so the bypass cannot leak past its region |

The error message names the model and operation and points at the escape hatch, so an offending
call site is findable from the stack alone.

**Call sites migrated.** The 12 BullMQ processors already used `runTenantScopedJob` (CLS populated)
and needed no change. The 8 `@Cron` entry points ran with no tenant context and were each converted —
choosing real per-tenant scoping over a blanket bypass wherever a tenant id was available:

| Cron | Treatment |
|---|---|
| `attendance.cron`, `library.cron` | Per-tenant work wrapped in `runWithTenantScope` (enumeration uses `Tenant`/`User`, already excluded models) |
| `usage.service` (`flushPendingUsage`) | Each pending counter carries its own tenant → `runWithTenantScope` |
| `homework.cron`, `finance.cron`, `notice-lifecycle.cron` | Cross-tenant **discovery** sweep wrapped in `runWithoutTenantScope`; each resulting item then processed under `runWithTenantScope` |
| `student-document-retention.cron`, `platform-billing-lifecycle` | Inherently platform-wide → `runWithoutTenantScope` with a stated reason |

Net effect: 5 of the 8 crons now run their actual work **more** tightly scoped than before, rather
than merely preserving the old unscoped behaviour.

### Runtime validation caught two breaks the test suites could not

Tests alone passed the fail-closed change, but running the actual API against the local stack showed
**login returning HTTP 500**. Two authentication-path breaks were only observable at runtime, because
every mocked suite replaces `@prisma/client` and so never executes the extension:

| Break | Detail |
|---|---|
| `User.findUnique` refused | `User` is **not** in `TENANT_SCOPE_EXCLUDED_MODELS`, yet authentication must resolve the user *before* any tenant is known. This broke `/auth/login` **and every authenticated request**, since `JwtAuthGuard` reads the user at line 59 but only sets CLS at line 168 |
| `AuditLog.create` refused | Audit rows carry an explicit caller-supplied `tenantId`, but login/failed-login/password-recovery events are written with no CLS tenant |

Both are inherent to the authentication boundary, not defects in the fail-closed design — and
notably `Tenant`, `RefreshToken` and `OtpCode` were *already* tenant-scope-excluded for exactly this
reason. `User` was simply the omission that fail-open had been hiding.

Fixed by declaring the pre-authentication region explicitly rather than excluding `User` globally
(which would have removed tenant scoping from every legitimate authenticated user query):

- `JwtAuthGuard` token-subject lookup → `runWithoutTenantScope`, with the existing
  `user.tenantId !== payload.tenantId` check still enforcing the boundary immediately after.
- `AuthService.preAuth()` helper wraps the 6 pre-authentication user reads/writes
  (`resolveTenantAndUser`, `resolveTenantAndUserById`, password recovery request + confirm,
  `completeAuthenticatedSession`, `recordFailedPasswordLogin`, `getPasswordIdentityHints`).
- `AuditService.record` → wrapped, since it always supplies `tenantId` itself.

Because the bypass only takes effect when a tenant context is genuinely absent, the authenticated
paths through these same helpers remain fully tenant-scoped.

**Runtime evidence after the fix** — `pnpm smoke:pilot` against the running API:

```
OK   Seeded school admin login
OK   Subject teacher cannot use class-teacher attendance route
OK   Principal can read mobile dashboard / attendance summary / transport alerts
OK   Principal dashboard omits sensitive internals
OK   Staff can read own attendance / leave / payslips ... Staff cannot list all payslips
OK   Accountant can list fee invoices / dues / collection report
OK   Driver can read own dashboard / assignments / manifest
OK   Driver cannot read another driver manifest
OK   Non-parent mobile child list fails closed
```

Zero `MissingTenantScopeError` occurrences during the full pilot run across teacher, principal,
parent, staff, accountant and driver personas. (The suite's 2 remaining failures are its own direct
Postgres/Redis connections, which bypass the API entirely and were failing before this work.)

**Regression result:** the change surfaced 3 test suites that had encoded the old contract
(`prisma.service.spec.ts` explicitly asserted *"delegate queries without injecting tenantId if
tenantId is not set in CLS"*, plus two cron specs whose local mocks lacked the helpers). All were
updated to the new contract; the fail-open assertion is now its inverse. Full unit suite returned to
the same 2 pre-existing failures with **no new breakage**.

Results: `students.service.spec.ts` **68/68 pass**; P0-01 focused suites (7) **72/72 pass**;
all `src/auth/guards` suites **68/68 pass**; entitlement suites **32/32 pass**;
`pnpm typecheck` (api + web) **PASS** (exit 0, 0 TS errors).

### Sweep coverage beyond `findUnique`

| Surface | Method | Result |
|---|---|---|
| Raw SQL (`$queryRaw` / `$executeRaw`) | repo-wide grep, non-spec sources | **0 occurrences** — entire injection/unscoped-raw risk class is absent |
| Tenant-owned set operations (`findMany`, `findFirst`, `updateMany`, `deleteMany`, `count`, `aggregate`, `groupBy`) | schema-derived list of **239** tenant-owned models, bracket-matched call args | 305 raw candidates, dominated by the safe read-then-`update({where:{id}})` pattern (Prisma requires a unique `where`, so tenant scope lives on the preceding validated read) and by `where: { ...scopedBase }` spreads the matcher cannot see |
| Protected-file / export paths | manual inspection of `studentDocument` / `generatedStudentDocument` / `studentDocumentHistory` reads | Tenant-wide reads confirmed to be **deliberate platform crons** (`processStudentDocumentExpiryReminders`), which carry `include: { tenant: true }` to route per tenant |
| Module entitlement fail-closed | `entitlement.guard.ts` review + 3 suites | **PASS** — denies on missing tenant, unknown tenant, suspended tenant, disabled module/feature, **and on any route that fails to declare a gate** (default-deny). 32/32 tests pass, incl. a route-coverage contract spec |

### Non-P0-01 defect observed during the sweep (logged, **now fixed** — see below)

`students.service.ts:4533` `processStudentDocumentExpiryReminders` takes `take: 500` across **all**
tenants ordered by `expiryDate`, then filters already-reminded documents **in memory**. A single
tenant holding 500+ already-reminded expiring documents can therefore starve every other tenant's
reminders for that run. This is a notification-delivery fairness defect (P0-07 / P0-09 territory),
not an authorization boundary defect — recorded here so it is not lost.

#### Resolution (2026-07-31)

| Item | Detail |
|---|---|
| Fix | The already-reminded exclusion moved from the in-memory loop into the `where` clause: `NOT: { history: { some: { action: 'EXPIRY_REMINDER_SENT', createdAt: { gte: dayStart, lt: dayEnd } } } }`. The `take: 500` now selects only documents that still need a reminder, so no tenant can spend the shared batch budget on work that will be discarded. Relation name `history` verified against `model StudentDocument` in `prisma/schema.prisma:7221` |
| Kept | The post-query `studentDocumentHistory` lookup remains as a secondary guard for rows reminded between the two reads; the `where` clause is now the primary defence |
| Regression test | `students.service.spec.ts` — *"does not let already-reminded documents consume the cross-tenant batch budget"*. 500 already-reminded documents from a noisy tenant sort ahead of one unreminded document from a quiet tenant; the prisma double applies the `where` before the `take`, the way Postgres does. Fails on the pre-fix code with `candidateDocuments` 500 instead of 1 (quiet tenant reminded 0 times), passes after |
| Results | `students.service.spec.ts` **68/68 pass**; `pnpm typecheck` **PASS** (exit 0) |
| Not claimed | Local unit-level proof only. Not exercised against a real multi-tenant database, and no staging or controlled-pilot validation of cron fairness |
| Scope note | The fix and its test live on branch `claude/great-golick-fefe97` (worktree `suspicious-goldberg-23d510`), not in this working tree — that branch is based on `e8b6440e` and does not contain the other uncommitted changes described in this note |

## Cross-tenant E2E matrix — mock-only proof replaced with real-database proof

**Gap found:** both existing jest configs map `@prisma/client` to `test/mocks/prisma-client.ts`, and
the previous P0-01 "E2E" suite (`test/teacher-scope-authorization.e2e-spec.ts`) is a hand-rolled fake
that documents itself as *"not a general query engine."* The single mechanism the entire tenant
isolation model depends on — the `PrismaService` `$extends` query extension — was therefore **never
executed by any test**. Every isolation claim to date was mock-only, which the P0 brief explicitly
disallows for production-critical workflows.

**Added:** `test/jest-integration.json` (no Prisma mock, `*.int-spec.ts`) and
`test/tenant-isolation.int-spec.ts`, running against real Postgres, plus
`pnpm test:integration` at both root and `@schoolos/api`.

| # | Assertion (real DB, two real tenants) | Result |
|---|---|---|
| 1 | `findMany` returns only tenant A rows | PASS |
| 2 | `findUnique` cannot read tenant B's class by its real id | PASS |
| 3 | `findFirst` cannot read tenant B's class by its real id | PASS |
| 4 | `count` excludes tenant B rows | PASS |
| 5 | `updateMany` cannot write tenant B's class (`count: 0`, value verified untouched) | PASS |
| 6 | `deleteMany` cannot destroy tenant B's class (`count: 0`, row verified surviving) | PASS |
| 7 | `create` **overwrites** an attacker-supplied foreign `tenantId` with the CLS tenant | PASS |
| 8 | Tenant B sees only its own row (fixture genuinely split, not vacuous) | PASS |
| 9 | No CLS tenant → **refuses** to read a tenant-scoped model | PASS |
| 10 | No CLS tenant → **refuses** to write a tenant-scoped model | PASS |
| 11 | Error names model + operation (`Class.deleteMany`) so the call site is findable | PASS |
| 12 | Excluded global model (`Tenant`) still reachable without tenant context | PASS |
| 13 | `runWithoutTenantScope` permits a deliberate sweep and sees every tenant | PASS |
| 14 | Fail-closed behaviour restored after the bypass region exits | PASS |
| 15 | `runWithoutTenantScope` rejects an empty reason | PASS |

Command and result (15 assertions after the fail-closed hardening below):

```bash
pnpm test:integration
# Test Suites: 1 passed, 1 total
# Tests:       15 passed, 15 total
```

Assertion 7 is the strongest positive result in this slice: a caller cannot plant a row into another
tenant even by explicitly passing that tenant's id. Assertion 9 deliberately pins the *current*
fail-open behaviour so the residual risk above is visible in CI rather than merely documented; its
comment instructs future readers to update the expectation, not revert, once the extension is
hardened to fail closed.

Fixtures use a timestamped `p0-01-int-<epoch>` slug/name prefix and are deleted in `afterAll`;
verified 0 leftover tenants and 0 leftover classes after the run, so this suite does not repeat the
known problem of web E2E specs polluting the shared demo tenant.

## Pre-existing baseline failure (NOT introduced by this slice)

The full mocked E2E suite is **red on `main`** and was red before any change in this slice:

```
Test Suites: 4 failed, 39 passed, 43 total
Tests:       9 failed, 274 passed, 283 total
```

| Failing suite | Failing cases |
|---|---|
| `test/auth-security-hardening.e2e-spec.ts` | 6 (tenant mismatch, inactive user/tenant, support-override x3, expired token) |
| `test/app.e2e-spec.ts` | 1 (multi-tenant onboarding / recovery / MFA) |
| `test/platform.e2e-spec.ts` | 1 (platform route restriction) |
| `test/attendance-teacher-scope-integration.e2e-spec.ts` | 1 (assigned roster / unassigned teacher block) |

**Attribution method:** `git stash push -- apps/api/src apps/api/package.json package.json`, then
re-ran exactly those four suites on the clean tree — **identical 4 suites / 9 tests failed**.
The failures are therefore pre-existing on `main`, not regressions from this work.

This matters for P0-01 specifically: the six failing `auth-security-hardening` cases are
*authorization regression tests* — tenant mismatch, inactive tenant, and support-override
enforcement. P0-01 cannot be signed off while its own authorization regression suite is red.

### All four suites diagnosed and fixed — E2E now green

Every failure was a **stale test**, not a product defect. Each was caused by a legitimate earlier
change whose specs were never updated:

| Suite | Root cause | Fix |
|---|---|---|
| `auth-security-hardening.e2e-spec.ts` | `JwtAuthGuard` gained a `MustChangePasswordGuard` dependency; the test module never provided it, so Nest DI failed to resolve the guard | Provide a `MustChangePasswordGuard` stub |
| `platform.e2e-spec.ts` | Same delegation: `getHandler`/`getClass` were `jest.fn()` returning `undefined`, and `Reflect.getMetadata(key, undefined)` throws `TypeError` | Return real metadata targets (`PlatformController.prototype.listTenants` / `PlatformController`) |
| `attendance-teacher-scope-integration.e2e-spec.ts` | The P0-08 student-leave auto-link slice (migration `20260731210000_p0_08_student_leave_requests`, same day) made `submitAttendance` read `studentLeaveRequest.findMany`; the spec's local `makePrisma()` had no such model | Add `studentLeaveRequest.findMany` to the local mock |
| `app.e2e-spec.ts` | Users are created with `mustChangePassword: true` (`users.service.ts:91`), so the guard correctly blocks the newly provisioned admin — **product behaviour is right, the test predates it** | Clear the flag in `authenticateRequest`; the first-login flow keeps its own coverage in `must-change-password.guard.spec.ts` and the m0-account-security seed |

```
Test Suites: 43 passed, 43 total
Tests:       283 passed, 283 total
```

The P0-01 authorization regression suite (`auth-security-hardening`) is **6/6 green**, so that
specific blocker to P0-01 sign-off is cleared.

### Remaining pre-existing failures (unit suite, NOT P0-01, NOT introduced here)

`pnpm --filter @schoolos/api exec jest` → **2 failed, 247 passed (2439/2441 tests)**. Both verified
pre-existing by the same stash-and-rerun method:

| Suite | Cause |
|---|---|
| `src/attendance/m2-attendance-hardening.service.spec.ts` | Expects `absent: 2.5, halfDay: 1`, receives `absent: 2, halfDay: 0` — half-day weighting changed with the P0-08 attendance status vocabulary work; the assertion was not updated. **P0-02 territory** — needs a decision on which behaviour is correct before editing the test |
| `prisma/seed.canonical.spec.ts` | Asserts the raw seed source `toContain('prisma.enrollment.upsert')`; the seed was refactored and the literal no longer appears. Same brittle regex-on-source pattern already known from the web suite |

Neither is an authorization defect. They are left failing deliberately rather than silently
adjusted, because the attendance one may indicate a real P0-02 correctness question.

## Honest posture

- **Do claim:** Local hardening and focused regression for the listed authorization gaps.
- **Do not claim:** Staging validated, controlled-pilot validated, GA/production release, or that every historical module path (frozen M13 Learning legacy assignment reads, full browser/device multi-user offline revocation matrix) is closed.
- Period attendance write APIs remain daily/homeroom-shaped; `PERIOD_ATTENDANCE_MARK` is defined, rule-tested, and reserved for subject-period writes when that workflow is exposed.
