# SchoolOS — Production Scaling Guide

Target deployment shape for one large school. Companion to
`ONE_SCHOOL_CONCURRENCY_TARGET.md`.

> **Current state.** The repository does **not** yet deploy in this shape. As
> of 2026-07-31 there is one API container that is also the worker, no
> PgBouncer, no separate worker service, and migrations run in the API
> entrypoint. This document is the target and the work needed to reach it, not
> a description of what exists.

---

## 1. Target topology

```text
                        load balancer (TLS, sticky sessions NOT required)
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
           api replica 1      api replica 2      api replica N
           (HTTP only)        (HTTP only)        (HTTP only)
                │                  │                  │
                └──────────────────┼──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
               PgBouncer                       Redis
            (transaction mode)         cache · rate limits · locks
                    │                    queues · usage counters
              PostgreSQL 16                       │
                                        ┌─────────┴─────────┐
                                        │                   │
                                  worker (critical)   worker (bulk)
                                  notifications       pdf · media
                                                      import/export
```

Sticky sessions must not be required. Any replica must serve any request —
that is what the statelessness work in §4 protects.

---

## 2. Connection budget

Size this **before** running load stages; connection exhaustion presents as
5xx, not as slow queries, and is easy to misdiagnose.

```text
PostgreSQL max_connections                         = 200
  reserved for superuser/admin                     =  10
  reserved for migrations (one-shot job)           =  10
  available to PgBouncer                           = 180

PgBouncer (transaction pooling)
  default_pool_size        per user/database       =  40
  max_client_conn          (app-side connections)  = 1000

API replica Prisma pool    connection_limit        =  10   (per replica)
Worker replica Prisma pool connection_limit        =   5   (per replica)
```

With 6 API replicas and 2 workers: `6×10 + 2×5 = 70` client connections into
PgBouncer, multiplexed onto ~40 real PostgreSQL connections. That leaves large
headroom against the 60% normal / 80% peak targets.

Set the pool explicitly — Prisma's `PrismaPg` adapter currently receives only a
connection string and falls back to node-postgres' default of **10**, which is
not a deliberate choice:

```ts
// apps/api/src/prisma/prisma.service.ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
```

### Transaction-pooling compatibility

Before enabling PgBouncer transaction mode, confirm the application does not
rely on session state that does not survive it: session-level `SET`, advisory
locks held across statements, `LISTEN/NOTIFY`, or long-lived prepared
statements. Prisma with the `pg` adapter is generally compatible, but this must
be checked, not assumed.

### Alerts

| Condition | Severity |
| --- | --- |
| PgBouncer `cl_waiting` > 0 sustained 1 min | warning |
| Pool utilisation > 60% sustained 5 min | warning |
| Pool utilisation > 80% | critical |
| Any pool-acquire timeout | critical |
| Deadlocks > 0 | critical |

---

## 3. Separating workers from the API

Today every `@Processor` lives in `AppModule`, so every API replica is also a
worker for all eleven queues. Report-card and receipt PDF generation, `sharp`
media compression, and bulk import/export share the request-handling event
loop.

Target:

1. Add `apps/api/src/worker.ts` bootstrapping a `WorkerModule` that imports the
   processor-owning modules and no HTTP layer.
2. In the API process, register queues as **producers only** — gate processor
   registration behind an env flag (`ROLE=api` vs `ROLE=worker`).
3. Deploy workers as a separate service with independent replica count.
4. Split queues by workload class so bulk work cannot starve delivery:

```text
notification-critical   emergency alerts, attendance alerts
notification-standard   digests, general notices
pdf-generation          report cards, receipts, payslips
media-processing        activity media compression
import-export           bulk imports, data exports
finance-processing      invoicing, reconciliation
offline-sync            mobile replay
```

Set per-queue concurrency deliberately; total worker concurrency is what
consumes the worker connection budget in §2.

---

## 4. Statelessness requirements

| State | Correct home | Current state |
| --- | --- | --- |
| Business data | PostgreSQL | correct |
| Queue state | Redis / BullMQ | correct |
| **Rate limits** | **Redis** | **in-memory — must fix** |
| Usage counters | Redis + periodic flush | fixed 2026-07-31 |
| Per-request memoization | request scope only | correct |
| Refresh sessions | PostgreSQL (`RefreshToken`) | correct |
| Uploaded files | object storage | adapters exist; verify no local-disk dependency |

### Rate limiting is the outstanding statelessness defect

`ThrottlerModule` in `app.module.ts` is configured with no `storage`, so
`@nestjs/throttler` uses its in-memory store. With N replicas every limit is
effectively N× more permissive, counters reset on deploy, and the auth
brute-force limit — the one that matters — does not hold. Move it to the shared
Redis instance and add a test proving a limit is enforced across two guard
instances sharing one Redis.

---

## 5. Redis configuration

`RedisService` currently accepts only host and port — no password, no TLS, no
db index. This blocks every managed Redis offering and prevents separating
queue traffic from cache traffic.

```ts
new Redis({
  host, port,
  password: configService.redisPassword,
  tls: configService.redisTls ? {} : undefined,
  db: configService.redisDb ?? 0,
  maxRetriesPerRequest: null,   // BullMQ requires null
  enableReadyCheck: false,
});
```

Once rate limits, caching, locks, and usage counters live in Redis, it is
correctness-critical: it needs persistence appropriate to its contents,
monitoring, and a documented failure policy (fail-open vs fail-closed) per use.

---

## 6. Migrations

`apps/api/docker-entrypoint.sh` runs `prisma migrate deploy` on every container
start. Correct for one container; unsafe for the target shape — N replicas race
on the migration advisory lock and produce a startup connection storm.

Move `migrate deploy` to a one-shot pre-deploy job; API and worker containers
start only after it succeeds.

---

## 7. Scaling decision order

When a stage fails its target, work in this order — it reflects what
measurement showed, not intuition:

1. **Reduce per-request query count.** Measured: the authenticated path issues
   16–126 SQL statements per request while `/health` sustains 21,164 rps. This
   dominates everything else.
2. **Remove contended writes from the request path.** Measured: removing one
   single-row counter upsert bought more throughput than removing two reads.
3. **Add API replicas.** Node is single-threaded and the API process saturates
   at ~97% of one core; replicas are how CPU headroom is added.
4. **Then** size the connection pool and add PgBouncer — the pool only becomes
   the constraint once 1–3 are done.
5. **Then** add caching and precomputation for the remaining hot reads.
6. Add indexes **only** where `EXPLAIN ANALYZE` against the realistic dataset
   justifies them.

Do not reach for indexes or caching first. At the time of measurement
PostgreSQL was idle (1 active connection) while the API was CPU-bound — adding
indexes would have changed nothing.

---

## 8. Metrics to dashboard

**API** — rps, in-flight requests, p50/p95/p99 by endpoint tag, 4xx/5xx rate,
event-loop delay, CPU, RSS, GC pause, request timeouts.

**PostgreSQL** — active/waiting connections, pool utilisation, slow queries,
lock waits, deadlocks, sequential scans, index hit rate, transaction duration,
disk I/O.

**Redis** — memory, connected clients, command latency, evictions, cache hit
rate, rate-limit ops, queue depth.

**Queues** — active/waiting/delayed/failed, dead-letter count, oldest waiting
job age, average and maximum job duration.

Oldest-waiting-job-age is the single most useful queue alert: it catches a
stalled worker that a depth metric alone can miss.

---

## 9. Capacity planning inputs

Once Scenario E has run in the target shape, record here:

```text
Verified concurrent users:        <unmeasured>
Verified sustained rps:           <unmeasured>
API replicas required:            <unmeasured>
Worker replicas required:         <unmeasured>
Peak pool utilisation:            <unmeasured>
Headroom to first bottleneck:     <unmeasured>
```

These stay `<unmeasured>` until an executed run fills them in.
