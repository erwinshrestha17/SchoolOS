# SchoolOS — Performance & Concurrency Bottleneck Register

Status: **audit pass 1 complete — findings recorded, not yet all remediated**
Method: static inspection of `apps/api`, `apps/web`, `apps/schoolos_mobile`,
Prisma schema, Redis/BullMQ wiring, and deployment configuration.
Date: 2026-07-31

> **Evidence discipline.** Every finding below cites a concrete file and line
> from the repository at the commit audited (`037746ea`). Findings marked
> `MEASURED` have load-test evidence in `LOAD_TEST_RESULTS.md`. Findings marked
> `INSPECTED` are derived from code reading and query counting, and their
> latency cost is an estimate until the baseline run confirms it. Do not quote
> an `INSPECTED` finding's numbers as measured fact.

Repository scale at audit time: 105 controllers, 1,345 routes, 676 `findMany`
call sites, 8,304-line Prisma schema, 90 migrations.

---

## Severity key

| Level | Meaning |
| --- | --- |
| **P0** | Blocks the 1,000-user target, or is a correctness/isolation risk under concurrency |
| **P1** | Materially degrades latency or capacity at peak |
| **P2** | Worth fixing; not on the critical path to the target |

---

## P0-1 — Every authenticated request costs 16+ uncached database queries before business logic

**Status:** `MEASURED` — partially fixed 2026-07-31

> **Measured correction.** The static estimate below said ~8 queries. Direct
> measurement with `log_statement='all'` found **18** for the cheapest endpoint,
> **29** for `mobile/me/students`, and **138** for `mobile/me/dashboard`.
> Prisma does not emit the `JwtAuthGuard` nested `include` as one join — it
> issues **six separate round-trips**. Full trace in `BASELINE_RESULTS.md` §6.
>
> **Partially fixed.** Per-request memoization of entitlements, tenant status,
> and the active-subscription lookup landed 2026-07-31, taking the cheapest
> endpoint 18 → 16 statements and raising throughput 51–83% on the light
> parent endpoints (`LOAD_TEST_RESULTS.md` Run 3). **The six `JwtAuthGuard`
> round-trips remain** and are now the largest single block.
**Files:** `apps/api/src/auth/guards/jwt-auth.guard.ts:59`,
`apps/api/src/auth/guards/entitlement.guard.ts:60,85,98,111`,
`apps/api/src/plans/plans.service.ts:35,72`,
`apps/api/src/plans/entitlements.service.ts:70`

### Root cause

Two global-ish guards run per request and neither caches anything.

**`JwtAuthGuard`** issues one deep six-level join on every single request:

```ts
// jwt-auth.guard.ts:59
const user = await this.prisma.user.findUnique({
  where: { id: payload.sub },
  include: {
    tenant: true,                                  // all Tenant columns
    userRoles: { include: { role: { include: {
      rolePermissions: { include: { permission: true } } } } } },
  },
});
```

That is `User → Tenant → UserRole → Role → RolePermission → Permission`. For a
user with 3 roles × ~40 permissions this materialises ~120 joined rows per
request, purely to rebuild a `permissions: string[]` array that changes only
when an administrator edits a role. It also selects the full `User` row,
including `passwordHash`, into process memory on every request.

**`EntitlementGuard`** then issues up to **seven more** queries. Traced for a
typical parent mobile request — `MobileController` carries
`@Entitlement(FEATURE_KEYS.MOBILE_PARENT_BASIC)` at class level and
`@RequiredModule('students')` on the handler:

| # | Call | Query |
| --- | --- | --- |
| 1 | `plansService.getTenantStatus` | `tenant.findUnique` |
| 2 | `entitlements.checkModuleEnabled` → `getEntitlements` | `tenant.findUnique` |
| 3 | ″ | `tenantSubscription.findFirst { plan: { features } }` (3-table join) |
| 4 | `plansService.checkFeatureEnabled` | `tenant.findUnique` |
| 5 | ″ | `tenantSubscription.findFirst` |
| 6 | ″ → `entitlements.checkFeatureEnabled` → `getEntitlements` | `tenant.findUnique` |
| 7 | ″ | `tenantSubscription.findFirst { plan: { features } }` (3-table join) |

`getEntitlements` (`entitlements.service.ts:70`) has no memoization at any
layer — not per-request, not per-process, not in Redis. There is **no caching
layer in the API at all**: no `CacheModule`, no `cache-manager`, and no Redis
read-through anywhere in `plans/`.

### Risk

For a single-tenant deployment this is the dominant fixed cost of every
request. The data is near-static (tenant active flag, subscription plan,
plan features) and identical for all 3,065 users. At the 100–200 rps sustained
target this is **800–1,600 queries/second of pure tenant-configuration lookup**,
before a single line of business logic runs. Combined with P0-2 it is the most
likely first bottleneck.

### Recommended fix

1. Per-request memoization in CLS (removes the duplicate queries 4–7 immediately —
   queries 2/3 and 6/7 are literally the same call twice).
2. Redis read-through cache for `getEntitlements(tenantId)` and
   `getTenantStatus(tenantId)`, keyed `tenant:{tenantId}:entitlements`, with
   explicit invalidation on subscription/plan/tenant-status writes.
3. Replace the `JwtAuthGuard` deep include with a narrow `select`, and cache the
   resolved `{roles, permissions}` per user in Redis with invalidation on
   role/permission writes. Keep the `status`/`isActive` freshness check.

Deferring #3 is acceptable if #1 and #2 land first; #3 carries authorization
invalidation risk and needs its own tests.

---

## P0-2 — Prisma connection pool is unconfigured; defaults to 10 connections per replica, and there is no PgBouncer

**Status:** `MEASURED` — open, but **not the current bottleneck**

> **Measured correction.** Under sustained load at `c=100`, PostgreSQL held
> **1 active and 9 idle** connections while the API process sat at **97.3%
> CPU**. The pool is *not* the binding constraint today — API-process CPU is.
> Pool sizing becomes the constraint only after per-request query count drops
> and replicas are added. Size it before running load stages regardless, since
> exhaustion presents as 5xx rather than as slow queries.
**Files:** `apps/api/src/prisma/prisma.service.ts:72`, `docker-compose.staging.yml`,
`deploy/env.staging.example`

### Root cause

```ts
// prisma.service.ts:72
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
```

No `max`, no `connection_limit`, no `pool_timeout`. `@prisma/adapter-pg` hands
this to a node-postgres `Pool`, whose default `max` is **10**. Grep confirms
`connection_limit` appears nowhere in the repository, and no `DATABASE_URL` in
any compose or env example carries the parameter.

There is no PgBouncer service in `docker-compose.staging.yml` — the API talks
to PostgreSQL directly.

### Risk

With ~8 queries per request (P0-1) each holding a pooled connection, 10
connections per replica is the binding constraint long before CPU. Adding
replicas multiplies raw PostgreSQL connections with nothing in between to
absorb them; PostgreSQL's own default `max_connections` is 100, so roughly 10
API replicas plus workers saturate the database outright. Under burst this
presents as pool-acquire timeouts and 5xx, not as slow queries — which makes it
easy to misdiagnose.

### Recommended fix

Make pool size explicit and environment-driven; introduce PgBouncer in
transaction-pooling mode; budget connections across API replicas, workers,
migrations, and admin access. Target: normal < 60%, peak < 80%, exhaustion = 0.
Note that transaction pooling requires reviewing any use of session-level state
(prepared statements, advisory locks, `SET`).

---

## P0-3 — Rate limiting is process-local, so it does not survive multiple API replicas

**Status:** `INSPECTED` — open
**Files:** `apps/api/src/app.module.ts:72`, `apps/api/src/auth/guards/app-throttler.guard.ts`

### Root cause

```ts
// app.module.ts:72
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => { ... return [{ name: 'default', limit: 100, ttl: 60000 }]; },
}),
```

No `storage` is supplied, so `@nestjs/throttler` falls back to its in-memory
`ThrottlerStorageService`. `AppThrottlerGuard` layers per-path limits for
`/auth/`, QR resolution, and API keys on top of that same in-memory store.

### Risk

This is both a scaling defect and a security control failure, and it is the
clearest violation of the "stateless API replicas" requirement:

- With N replicas behind a load balancer, every limit is effectively **N× more
  permissive** than configured. The auth brute-force limit is the one that
  matters most.
- Counters reset on every deploy, restart, and autoscale event.
- A user's requests landing on different replicas see different counters.

### Recommended fix

Move throttler storage to the shared Redis instance
(`@nest-lab/throttler-storage-redis` or an equivalent `ThrottlerStorage`
implementation backed by the existing `RedisService`). Add a test that proves a
limit is enforced across two independently constructed guard instances sharing
one Redis.

---

## P0-4 — Background workers run inside the API process; there is no separate worker deployment

**Status:** `INSPECTED` — open
**Files:** `apps/api/src/app.module.ts` (all feature modules imported into one
`AppModule`), `apps/api/Dockerfile:36`, `docker-compose.staging.yml`

### Root cause

All 11 BullMQ processors are registered in modules that `AppModule` imports:

```text
notifications  reports          academics       homework
finance        accounting-reports  accounting-bank-import
payroll        canteen-alerts   activity-media  advanced-operations
```

There is exactly one process entrypoint — `CMD ["node", "dist/apps/api/src/main.js"]`
— and one `api` service in the compose file. Every API replica is therefore
also a full worker for every queue.

### Risk

Heavy jobs share the API's single Node event loop. The concrete offenders are
report-card and receipt/payslip PDF generation, `sharp`-based media compression
in `activity-media`, and bulk import/export. Result publication (Scenario D) is
precisely the moment when PDF generation and peak parent read traffic collide —
on the same event loop, competing for the same 10-connection pool.

This also means worker concurrency scales accidentally with API replica count,
multiplying database connection demand (compounds P0-2).

### Recommended fix

Add a second entrypoint (`worker.ts`) with a `WorkerModule` that imports the
processor-owning modules but no HTTP layer; make the API process register
queues as producers only, gated by an env flag. Deploy as a separate service
with its own replica count and connection budget. Split queues by workload
class so PDF generation cannot starve notification delivery.

---

## P0-5 — Database migrations run in the entrypoint of every API container

**Status:** `INSPECTED` — open
**File:** `apps/api/docker-entrypoint.sh`

```sh
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma
exec "$@"
```

### Risk

Correct for a single container; unsafe the moment the deployment has multiple
API replicas — which is the stated target shape. N replicas starting together
race on `prisma migrate deploy` and on the migration advisory lock, producing a
startup connection storm and slow/failed rollouts.

### Recommended fix

Move `migrate deploy` to a dedicated pre-deploy job or init container that runs
exactly once per release; API containers start only after it succeeds.

---

## P0-6 — Write amplification: every API request incremented a single shared counter row

**Status:** `MEASURED` — **fixed 2026-07-31**
**Files:** `apps/api/src/usage/usage.interceptor.ts`, `apps/api/src/usage/usage.service.ts`

Found by measurement, not by inspection. `UsageInterceptor` runs on every
request and called `usageCounter.upsert(... value: { increment: 1 })`. For a
single-tenant deployment `(tenantId, 'api.requests', 'MONTHLY', periodStart)`
resolves to **one row for the entire school for a whole month**, so every
request — including every GET — took a row-level exclusive lock on that one
row. It was also fire-and-forget inside `tap()`, so pending upserts grew
without back-pressure under load.

This was a global serialization point and, on the evidence of Run 3, the single
largest contributor to the throughput ceiling: removing it raised
`mobile/me/students` from 217 to 396 rps (+83%) while reducing query count by
only ~24%.

**Fixed:** deltas now accumulate in Redis (`HINCRBY`) and flush to PostgreSQL
once a minute, with fallback to the direct write if Redis is unavailable and
batch return-to-Redis if the database write fails. Reads add the un-flushed
delta so limit checks stay exact. See `CONCURRENCY_CORRECTNESS.md` §2.

---

## P1-1 — No parent bootstrap endpoint; startup fan-out is unmeasured

**Status:** `INSPECTED` — open
**Files:** `apps/api/src/mobile/mobile.controller.ts`, `apps/api/src/mobile/mobile.service.ts:206`

`GET /api/v1/mobile/bootstrap` does not exist. The closest equivalent is
`GET mobile/me/dashboard` (`mobile.service.ts:206`), which does compose
server-side and fans out to eight sub-queries via `Promise.all` — a reasonable
shape. But:

- it calls `listMyStudents` **and** `getEntitlements` before the fan-out, and
  several of the eight branches call `getEntitlements` again;
- it returns full child objects plus notices plus activity in one payload with
  no size bound or ETag;
- there is no sync cursor, so the client cannot do delta refresh.

Startup request count and payload size from the Flutter app have **not** been
measured yet. That measurement is a prerequisite before designing the endpoint —
recorded as a gap, not yet a diagnosis.

---

## P1-2 — Redis client supports neither password nor TLS nor db index

**Status:** `INSPECTED` — open
**File:** `apps/api/src/redis/redis.service.ts:13`

```ts
this.client = new Redis({
  host: this.configService.redisHost,
  port: this.configService.redisPort,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});
```

Same omission in the BullMQ root connection (`app.module.ts:89`). A production
Redis reachable only on a private network is survivable, but this blocks using
any managed Redis (all of which require AUTH, most require TLS) and prevents
separating queue traffic from cache traffic by db index. `maxRetriesPerRequest: 2`
is also the wrong setting for a BullMQ connection, which expects `null`.

Since this program is about to put rate limiting, caching, and distributed locks
on Redis, Redis becomes a correctness-critical dependency and needs proper
connection configuration and failure handling.

---

## P1-3 — Mobile parent attendance screen polls every 60 seconds

**Status:** `INSPECTED` — open
**File:** `apps/schoolos_mobile/lib/features/attendance/presentation/screens/parent_attendance_screen.dart:90`

```dart
_autoRefreshTimer = Timer.periodic(const Duration(minutes: 1), (_) { ... });
```

Attendance is written once or twice per school day. A 60-second poll held open
by 3,000 parent accounts is up to 50 rps of pure waste, concentrated in exactly
the morning window that Scenario B targets. Replace with refresh-on-foreground
plus push invalidation.

**Positive finding:** the web client has no `refetchInterval` or `setInterval`
polling — a prior cleanup already addressed it there.

---

## P2-1 — 676 `findMany` call sites not yet swept for unbounded reads

**Status:** `INSPECTED` — open, scope-limited

`apps/api/AGENTS.md` already forbids unbounded `findMany`, and spot checks of
the mobile parent paths show `take`/pagination in use. A full sweep of all 676
sites has **not** been done and is not claimed. This is recorded so the gap is
visible; it should be driven by baseline slow-query evidence rather than by
reading all 676 sites.

---

## Deliberately not concluded yet

The following were requested in the program brief and are **not** yet assessed.
They are listed so the audit's coverage is not overstated:

- N+1 patterns outside the auth/entitlement/parent-dashboard paths
- index adequacy (requires `EXPLAIN ANALYZE` against realistic data volumes)
- attendance / marks / payment idempotency and race behaviour under real
  concurrency (design review done; concurrent execution not yet run)
- notification fan-out synchronicity
- transaction boundary correctness
- memory growth and GC behaviour
- queue backlog behaviour under sustained load

These require the seeded dataset and baseline run to assess honestly.

---

## P1-4 — `mobile/me/dashboard` fan-out

**Status:** `MEASURED` — **substantially fixed 2026-07-31**, partially open

> **Fixed.** A request-scoped `ParentScopeContextService` removed the repeated
> guardian, child-roster, and per-capability authorization queries:
> **151 → 83 statements**, **53 → 74 rps**, and `parent/bootstrap`
> **p95 864 ms → 507 ms at 100 concurrent parents**, meeting the < 600 ms
> target. Response body verified byte-identical. See `LOAD_TEST_RESULTS.md`
> Run 5.
>
> **Still open:** the < 40 statement target was not reached. The remaining 83
> are dominated by each sub-service's own queries — transport (~14), activity
> (~8), canteen (~7), fees (~6) — which need per-module batching slices rather
> than shared-context work.

The de-facto parent bootstrap costs **126 statements** and **907 ms p50 at
c=50** against the 1,500-student dataset, and misses its < 800 ms p95 target at
**100 concurrent parents** — one seventh of the 750-user peak goal
(`LOAD_TEST_RESULTS.md` Run 4).

Only ~10 of those statements are guard overhead; the rest are the endpoint's
own fan-out across eight sub-services, several of which re-resolve entitlements
and re-query the child roster. This is now the highest-value remaining target
and is the concrete work behind P1-1.

---

## Priority order for remediation

Reordered after measurement.

| Order | Finding | Status | Rationale |
| --- | --- | --- | --- |
| — | P0-6 | **done** | Removed a global write serialization point; biggest single measured gain |
| — | P0-1 (partial) | **done** | Per-request memoization; +51–83% on light endpoints |
| 1 | P1-4 | open | Parent bootstrap is the endpoint that misses its target first |
| 2 | P0-1 (remainder) | open | Six `JwtAuthGuard` round-trips per request; needs a permission cache with invalidation |
| 3 | P0-3 | open | Statelessness + auth brute-force correctness; blocks multi-replica |
| 4 | P0-4 | open | Blocks Scenario D from being meaningful |
| 5 | P0-5 | open | Blocks multi-replica rollout |
| 6 | P0-2 | open | Size before load stages, though not the current constraint |
| 7 | P1-2, P1-3 | open | Bounded, independent |
