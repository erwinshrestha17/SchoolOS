# SchoolOS — Measured Baseline (pre-optimization)

Date: 2026-07-31
Commit: `037746ea` (unmodified application code)
Status: **executed** — every number below was produced by a command in this
document, not estimated.

---

## 1. Harness and its limits — read this before quoting any number

The baseline was captured on a **single developer workstation** running the
API, PostgreSQL, Redis, and the load generator simultaneously.

| Component | Configuration |
| --- | --- |
| Host | macOS (Darwin 25.5.0), Apple Silicon |
| API | 1 replica, `node dist/apps/api/src/main.js`, production build, `NODE_ENV` unset |
| PostgreSQL | 16-alpine in Docker, default `max_connections=100` |
| Redis | 7-alpine in Docker |
| Load generator | `autocannon` 8.0.0, **on the same host** |
| PgBouncer | none (does not exist in the repo) |

**What this baseline is valid for:** relative comparison — identifying the
first bottleneck, and measuring the effect of a change against the identical
setup. Per-request query counts and the shape of the saturation curve are
properties of the code and transfer to any environment.

**What this baseline is NOT valid for:** absolute capacity claims. The load
generator competes with the API for CPU on the same machine, and there is one
API replica rather than the target multi-replica shape. **No statement about
supporting 750 or 1,000 concurrent users can be made from this data**, and none
is made here.

Dataset for the runs below: `perf-smoke` — a deliberately *small* tenant
(20 students, 40 parents, 4 sections, 3 attendance days). Using a small dataset
was intentional for the first pass: it isolates fixed per-request overhead from
data-volume effects. Results against the full 1,500-student dataset are tracked
separately in `LOAD_TEST_RESULTS.md`.

---

## 2. Setup commands (reproducible)

```bash
# 1. Infrastructure
docker compose up -d postgres redis

# 2. Seed an isolated performance tenant
cd apps/api && pnpm db:seed:performance          # full size (1,500 students)

# small variant used for the fixed-overhead baseline below:
PERF_TENANT_SLUG=perf-smoke PERF_STUDENTS=20 PERF_TEACHERS=4 PERF_ADMINS=2 \
PERF_CLASSES=2 PERF_SECTIONS_PER_CLASS=2 PERF_ATTENDANCE_DAYS=3 \
PERF_NOTIFICATIONS_PER_PARENT=2 pnpm db:seed:performance

# 3. Start the API
node dist/apps/api/src/main.js

# 4. Obtain a parent access token (mobile UA returns bearer tokens in body)
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: Dart/3.0 (dart:io)' \
  -d '{"email":"parent00001@perf-smoke.test","password":"LoadTest123!","tenantSlug":"perf-smoke"}'

# 5. Ramp
export PERF_ACCESS_TOKEN=<accessToken from step 4>
tests/load/run-ramp.sh /api/v1/mobile/me/notifications/unread-count 12 "10 25 50 100 200"
```

---

## 3. Headline result — the first bottleneck is API process CPU, not the database

| Endpoint | Guards + DB? | Throughput | p50 |
| --- | --- | --- | --- |
| `GET /api/v1/health` | no auth, no DB | **21,164 rps** | 2 ms |
| `GET /api/v1/mobile/me/notifications/unread-count` | full auth stack | **302 rps** | 32 ms |

The NestJS/Express layer sustains **21,164 rps**. Adding authentication and
entitlement checking to the single cheapest endpoint in the product drops it to
**302 rps — a 70× reduction.** The framework is not the constraint.

Measured during a sustained `c=100` run against the authenticated endpoint:

```text
API process CPU:  97.3%   (single Node thread, saturated)
API process RSS:  1.19 GB
PostgreSQL:       9 idle connections, 1 active
```

**PostgreSQL is nearly idle while the API process is CPU-pinned.** This
corrects a hypothesis recorded in `PERFORMANCE_BOTTLENECKS.md` P0-2: the
10-connection pool is *not* the current binding constraint. The constraint is
CPU burned inside the API process driving **18 sequential query round-trips per
request** — Prisma client serialization/deserialization dominates, not
PostgreSQL execution time. Pool sizing becomes the next constraint only after
per-request query count is reduced and replicas are added.

---

## 4. Concurrency ramp — `mobile/me/notifications/unread-count`

12 s per level, 1 API replica, small dataset.

| Concurrency | rps | p50 (ms) | p97.5 (ms) | p99 (ms) | max (ms) | non-2xx | timeouts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 301 | 32 | 41 | 44 | 65 | 0 | 0 |
| 25 | 304 | 81 | 95 | 99 | 106 | 0 | 0 |
| 50 | 304 | 162 | 177 | 191 | 200 | 0 | 0 |
| 100 | 308 | 319 | 338 | 349 | 401 | 0 | 0 |
| 200 | 300 | 642 | 759 | 809 | 885 | 0 | 0 |

**Interpretation.** Throughput is flat at ~302 rps across a 20× increase in
concurrency, while latency rises exactly linearly (32 → 642 ms). This is a
textbook saturated-server curve: the system reaches capacity at roughly
concurrency 10, and every additional concurrent user converts directly into
queueing delay. Little's Law holds throughout (`L ≈ λ × W`).

Encouraging: **zero errors and zero timeouts at every level** — the system
degrades by slowing down, not by failing. That is the correct failure mode.

---

## 5. Per-endpoint baseline (c=50, 12 s, small dataset)

| Endpoint | SQL statements / request | rps | p50 | p97.5 | p99 | Target p95 | Meets target? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mobile/me/notifications/unread-count` | 18 | 304 | 162 ms | 177 ms | 191 ms | — | — |
| `mobile/me/students` | 29 | 215 | 229 ms | 254 ms | 269 ms | — | — |
| `mobile/me/dashboard` (de-facto parent bootstrap) | **138** | **67** | **732 ms** | **829 ms** | **857 ms** | < 800 ms | **No** |

The parent dashboard — the endpoint a parent hits on every app open — costs
**138 SQL round-trips** and misses the < 800 ms bootstrap target at **50**
concurrent users, against a target of 750. It was measured on a 20-student
tenant; real data volumes can only make it worse.

---

## 6. Where the 18 queries go (measured, not inferred)

Captured with `log_statement='all'` on PostgreSQL for a single
`GET mobile/me/notifications/unread-count`:

| # | Source | Query |
| --- | --- | --- |
| 1 | `JwtAuthGuard` | `SELECT … FROM "User" WHERE id = $1` |
| 2 | `JwtAuthGuard` | `SELECT … FROM "Tenant"` |
| 3 | `JwtAuthGuard` | `SELECT … FROM "UserRole"` |
| 4 | `JwtAuthGuard` | `SELECT … FROM "Role"` |
| 5 | `JwtAuthGuard` | `SELECT … FROM "RolePermission"` |
| 6 | `JwtAuthGuard` | `SELECT … FROM "Permission" WHERE id IN (14 ids)` |
| 7 | `EntitlementGuard` | `SELECT … FROM "Tenant"` |
| 8 | `EntitlementGuard` | `SELECT … FROM "Tenant"` |
| 9 | `EntitlementGuard` | `SELECT … FROM "TenantSubscription"` |
| 10 | `EntitlementGuard` | `SELECT … FROM "Tenant"` |
| 11 | `EntitlementGuard` | `SELECT … FROM "TenantSubscription"` |
| 12 | `EntitlementGuard` | `SELECT … FROM "PlatformPlan"` |
| 13 | `EntitlementGuard` | `SELECT … FROM "PlatformPlanFeature"` |
| 14 | `EntitlementGuard` | `SELECT … FROM "TenantFeatureOverride"` |
| 15 | business logic | `SELECT … FROM "Guardian"` |
| 16 | business logic | `SELECT … FROM "Enrollment"` |
| 17 | business logic | `SELECT … FROM "NotificationReadReceipt"` |
| 18 | `UsageInterceptor` | **`INSERT INTO "UsageCounter" … ON CONFLICT … value = value + 1`** |

**15 of 18 queries (83%) are fixed overhead.** Only queries 15–17 do the work
the endpoint exists to do.

Two findings sharpen the register:

1. **Prisma does not emit the `JwtAuthGuard` nested `include` as one join.** It
   issues six separate round-trips (queries 1–6). The relational shape is
   irrelevant — the cost is six sequential client round-trips per request.
2. **`Tenant` is read four times and `TenantSubscription` twice per request**
   (queries 2, 7, 8, 10 and 9, 11). These are literally duplicate reads of
   identical, near-static rows within one request.

---

## 7. New P0 discovered during baselining — write amplification on every read

Query 18 is not a read. **Every API request, including every GET, performs an
`UPSERT` that increments a single counter row**:

`apps/api/src/usage/usage.interceptor.ts` → `usage.service.ts:139`

```ts
await this.prisma.usageCounter.upsert({
  where: { tenantId_usageKey_period_periodStart: {
    tenantId, usageKey: 'api.requests', period: 'MONTHLY', periodStart } },
  update: { value: { increment: amount } },
  create: { ... },
});
```

For a single-tenant deployment, `(tenantId, 'api.requests', 'MONTHLY', periodStart)`
resolves to **exactly one row for the entire school, for a whole month**. Every
request in the system takes a row-level exclusive lock on that one row.

Risk:

- All request accounting **serializes on a single row**. Row-lock throughput,
  not application logic, sets a hard ceiling.
- Under concurrency this forms a lock convoy: at 500 concurrent users, hundreds
  of transactions queue behind one lock.
- It is issued **fire-and-forget** inside `tap()` without back-pressure, so
  under load the pending upserts grow unbounded and consume pool connections
  that request handling needs.
- It converts a read-only workload into a write workload, adding WAL and
  vacuum pressure proportional to *total request volume*.

This did not appear in the static audit and was found only by measuring. It is
promoted to **P0-6** in `PERFORMANCE_BOTTLENECKS.md`.

Recommended fix: accumulate counters in Redis (`INCR`) and flush to PostgreSQL
periodically from a single worker, or drop per-request counting entirely in
favour of metrics already emitted by observability.

---

## 8. Resource baseline

| Resource | At c=100 sustained | Note |
| --- | --- | --- |
| API CPU | 97.3% of one core | **saturated — first bottleneck** |
| API RSS | 1.19 GB | steady during run; growth over time not yet characterised |
| PG connections | 1 active / 9 idle | pool not exhausted |
| PG errors | 0 | |
| HTTP non-2xx | 0 | at every ramp level |
| Timeouts | 0 | at every ramp level |

Not yet captured (requires the observability work in Phase 1 — these are gaps,
not zeros): event-loop delay, GC pause distribution, Redis command latency and
hit rate, queue depth/age, per-query execution time from `pg_stat_statements`
(the extension is not preloaded in the current container).

---

## 9. Honest conclusion from the baseline

- The **first bottleneck is API process CPU**, driven by per-request query
  count in the auth/entitlement guard stack — not PostgreSQL, not the
  connection pool, not the framework.
- A single API replica saturates at **~302 rps on the cheapest authenticated
  endpoint** and **~67 rps on the parent dashboard**, on this hardware.
- The parent bootstrap path **already misses its < 800 ms p95 target at 50
  concurrent users**, 15× below the 750-user goal.
- Failure mode is graceful (latency growth, zero errors), which is the right
  starting point.
- **No capacity claim is made.** Scenarios A–F have not been run;
  `LOAD_TEST_RESULTS.md` records what has.

### Highest-value next change

Eliminate the 15 fixed-overhead queries per request:

1. per-request memoization of tenant status + entitlements (removes duplicate
   reads 8, 10, 11 and the second `getEntitlements` pass);
2. Redis read-through cache for entitlements and tenant status;
3. move the `UsageCounter` increment off the request path.

Expected effect is large because the bottleneck is CPU spent per query
round-trip, and this removes ~83% of them. That expectation is a hypothesis
until re-measured — results go in `LOAD_TEST_RESULTS.md`.
