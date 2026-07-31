# P0-14 Core Security and Data-Integrity (2026-07-31, local)

Status: **PARTIAL**

Scope for this batch: close the remaining code throttle gap on M1 guardian removal, strengthen ownership-audit active-relationship assertions, and establish a clean empty-database migration replay. Prior P0-14 local hardening (rate-limit fail-closed, StudentsController guardian throttles, notification redaction, outbound URL guard, platform protected-file exports) remains in place.

## Implementation completed in this batch

- Applied the same 10-request/minute guardian-admin `@Throttle` to `M1AdmissionsHardeningController.removeGuardianAccess`.
- Asserted ownership-audit `studentGuardian.findMany` uses the active/verified/approved/effective-window predicate.
- Added AppThrottlerGuard coverage for the M1 guardian-removal decorator.
- Replayed all 89 Prisma migrations onto an empty PostgreSQL database and confirmed `migrate status` is up to date.

## Migrations

None added. Replay used the existing `apps/api/prisma/migrations` history.

## Clean migration replay

| Step | Result |
|---|---|
| Create empty DB `schoolos_p014_migrate_replay` on `localhost:5433` | PASS |
| `prisma migrate deploy` (89 migrations) | PASS — all applied |
| `prisma migrate status` | PASS — Database schema is up to date |
| `_prisma_migrations` finished rows | 89 |
| `pnpm db:validate` | PASS |

```bash
docker exec schoolos_postgres psql -U schoolos -d postgres \
  -c "DROP DATABASE IF EXISTS schoolos_p014_migrate_replay;" \
  -c "CREATE DATABASE schoolos_p014_migrate_replay OWNER schoolos;"

DATABASE_URL='postgresql://schoolos:password123@localhost:5433/schoolos_p014_migrate_replay?schema=public' \
  pnpm --filter @schoolos/api exec prisma migrate deploy --schema prisma/schema.prisma

DATABASE_URL='postgresql://schoolos:password123@localhost:5433/schoolos_p014_migrate_replay?schema=public' \
  pnpm --filter @schoolos/api exec prisma migrate status --schema prisma/schema.prisma
```

## Focused verification

| Check | Result | Detail |
|---|---|---|
| M1 controller/service + AppThrottler specs | PASS | 25/25 |
| Broader security unit selection | PASS | 5 suites / 76 tests |
| Platform export web contract | PASS | 14/14 |
| `pnpm verify:openapi` | PASS | |
| `pnpm db:validate` | PASS | |

```bash
pnpm --filter @schoolos/api exec jest \
  src/admissions/m1-admissions-hardening.controller.spec.ts \
  src/admissions/m1-admissions-hardening.service.spec.ts \
  src/auth/guards/app-throttler.guard.spec.ts \
  src/common/security/outbound-url.spec.ts \
  src/config/config.service.spec.ts \
  src/students/students.controller.spec.ts \
  src/notifications/notifications.processor.spec.ts \
  --runInBand

node --test apps/web/test/platform-change-plan-contract.test.mjs
pnpm verify:openapi
pnpm db:validate
```

## Still incomplete for P0-14 close

| Gate | Status |
|---|---|
| Repository security scan (sealed report) | Incomplete — discovery worklist not closed; no sealed findings report |
| Staging secrets / provider checks (`pnpm verify:env:staging` on real staging host) | Incomplete — requires secure staging env file and HTTPS origins |
| Staging / pilot-host backup/restore drill | Incomplete — local rehearsal exists (`backup-restore-rehearsal-2026-07-29-local.md`); staging host drill remains |
| DNS/egress enforcement beyond static outbound URL parse | Incomplete — staging provider + network controls required |

## Honest posture

- **Do claim:** Local code hardening + clean empty-DB migration replay for this batch.
- **Do not claim:** P0-14 complete, staging validated, controlled-pilot validated, or GA readiness.
- Keep pilot release blocked until the three remaining ops/evidence gates above pass.
