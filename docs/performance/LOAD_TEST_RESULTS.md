# SchoolOS — Load Test Results

Every entry records an **executed** run. Scenarios with no entry have not been
run; that is stated rather than left implied.

---

## Run log

| Date | Scenario | Concurrency | Environment | Outcome |
| --- | --- | --- | --- | --- |
| 2026-07-31 | S (smoke) | 5 VU | single host, 1 replica | pass — harness validated |
| 2026-07-31 | endpoint ramp | 10–200 | single host, 1 replica | baseline captured |
| 2026-07-31 | C at `VU_SCALE=0.2` | 100 parents | single host, 1 replica | **bootstrap p95 822 ms — fails < 800 ms** |
| — | A | 200 | — | **not run** |
| — | B | 360 | — | **not run** |
| — | C (full, 500) | 500 | — | **not run** |
| — | D | 750 | — | **not run** |
| — | **E (required, 1,000)** | 1,000 | — | **not run** |
| — | F | →1,500 | — | **not run** |

Scenarios A–F require the separate-host, multi-replica environment described in
`LOAD_TEST_PLAN.md` §2. They were not run because that environment does not
exist yet — the repository has no multi-replica deployment, no separate worker
service, and no PgBouncer.

**No concurrency capacity claim is made in this document.**

---

## Run 1 — Harness validation (Scenario S)

```bash
k6 run -e SCENARIO=S tests/load/k6/scenarios.js
```

| Metric | Value |
| --- | --- |
| checks | 100.00% (77/77) |
| http_req_failed | 0.00% |
| http_req_duration p95 | 98 ms |
| `auth/login` p95 | 132 ms |
| `parent/bootstrap` p95 | 108 ms |
| `attendance/submit` p95 | 76 ms |

All persona workflows execute against real routes: parent bootstrap, unread
count, attendance summary, homework, timetable, notifications, fees; teacher
timetable, assigned-scope lookup, roster, attendance sync + retry.

---

## Run 2 — Endpoint concurrency ramp (pre-optimization baseline)

Full detail in `BASELINE_RESULTS.md`. Summary of the decisive finding:

| Endpoint | Guards + DB | Throughput | p50 |
| --- | --- | --- | --- |
| `/api/v1/health` | none | 21,164 rps | 2 ms |
| `mobile/me/notifications/unread-count` | full stack | 302 rps | 32 ms |

Under sustained load the API process sat at **97.3% CPU** while PostgreSQL held
**1 active / 9 idle** connections. The bottleneck is API-process CPU spent on
per-request query round-trips, not the database.

---

## Run 3 — Effect of the request-scoped cache + usage-counter change

Same host, same build pipeline, same 1,500-student dataset, `c=50`, 12 s,
autocannon. The only variable is the application change.

### Throughput and latency

| Endpoint | rps before | rps after | Δ | p50 before | p50 after | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| `mobile/me/notifications/unread-count` | 266 | **402** | **+51%** | 184 ms | **122 ms** | −34% |
| `mobile/me/students` | 217 | **396** | **+83%** | 227 ms | **124 ms** | −45% |
| `mobile/me/dashboard` | 46 | **54** | **+17%** | 1,042 ms | **907 ms** | −13% |

Zero non-2xx responses in every run, before and after.

### SQL statements per request

Measured with `log_statement='all'`, averaged over three requests.

| Endpoint | before | after |
| --- | --- | --- |
| `mobile/me/notifications/unread-count` | 18 | 16 |
| `mobile/me/students` | 29 | 22 |
| `mobile/me/dashboard` | 138 | 126 |

**Note the mismatch, because it matters for how the next change is chosen:**
query count fell only ~10% while throughput on the light endpoints rose 51–83%.
The gain came disproportionately from removing the `UsageCounter` upsert
(BASELINE_RESULTS.md §7) — a single-row write every request was serializing
concurrent requests behind one row lock. Removing a *contended write* bought far
more than removing two *uncontended reads*.

The dashboard gained least (+17%) precisely because its cost is dominated by its
own 126-query business-logic fan-out, which this change did not touch.

### What changed

| Change | File |
| --- | --- |
| Per-request memoization of entitlements, tenant status, active subscription | `src/common/cache/request-cache.service.ts`, `src/plans/entitlements.service.ts`, `src/plans/plans.service.ts` |
| `UsageCounter` increment moved off the request path to Redis `HINCRBY` + 1-minute flush | `src/usage/usage.service.ts` |

Scope of the cache is one request, so there is no cross-request staleness and
suspended tenants still fail closed on the next request. Usage counts remain
exact: reads add the un-flushed Redis delta, the flush is transactional
(`MULTI` + `HGETALL` + `DEL`), and a failed database write returns the batch to
Redis.

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `pnpm --filter @schoolos/api test` | 2,324 / 2,325 pass |
| `npx jest src/common/cache src/plans src/usage` | 28 / 28 pass |

The single failure is `src/service-requests/service-requests.service.spec.ts:113`
and was **confirmed pre-existing** by stashing all changes and re-running it on
unmodified `main`. It is unrelated to this work.

---

## Run 4 — Scenario C rehearsal at `VU_SCALE=0.2` (100 concurrent parents)

```bash
k6 run -e SCENARIO=C -e VU_SCALE=0.2 -e DURATION=3m tests/load/k6/scenarios.js
```

> This is **not** a Scenario C result. Scenario C is 500 parents; this ran 100,
> co-located with the API, on one replica. It is reported as the shape of the
> curve, not as capacity.

| Metric | Value | Target | Status |
| --- | --- | --- | --- |
| checks succeeded | 100.00% (3,906/3,906) | > 99.5% | pass |
| http_req_failed | 0.00% | < 0.5% | pass |
| http_req_duration p95 (all) | 425 ms | < 800 ms | pass |
| `auth/login` p95 | 1.20 s | < 2 s | pass |
| **`parent/bootstrap` p95** | **822 ms** | **< 800 ms** | **fail** |
| http_req_duration p99 | 1.02 s | — | — |

**The parent bootstrap misses its p95 target at 100 concurrent parents** — one
fifth of the evening-peak scenario and one seventh of the 750-user peak target.
Everything else passed comfortably, and there were zero errors.

This is the clearest statement of where SchoolOS currently stands: the system is
*correct and stable* under load, and *too slow on the single most important
parent endpoint* to meet the target.

---

## Run 5 — Parent dashboard fan-out optimization (bounded P0 slice)

Same host, same build pipeline, same 1,500-student `perf-school` dataset, same
concurrency and duration before and after. The only variable is the
application change.

### Results

| Metric | Before | After | Target | Status |
| --- | ---: | ---: | ---: | --- |
| SQL statements / request | 151 | **83** | < 40 | **missed** (−45%) |
| Throughput (c=50) | 53 rps | **74 rps** | ≥ 81 rps | **missed** (+40%) |
| p50 (c=50) | 903 ms | **655 ms** | — | −27% |
| p97.5 (c=50) | 1,032 ms | **717 ms** | — | −31% |
| p99 (c=50) | 1,044 ms | **773 ms** | — | −26% |
| **`parent/bootstrap` p95 @ 100 concurrent parents** | 864 ms | **507 ms** | < 600 ms | **met** |
| `parent/bootstrap` p99 @ c=100 | 896 ms | **531 ms** | — | −41% |
| API CPU @ c=100 | 82.9% | **49.6%** | — | −33 pts |
| PG connections @ c=100 | 4 active / 9 idle | 7 active / 6 idle | no regression | ok |
| HTTP 5xx | 0 | **0** | 0 | met |
| Response payload | 14,109 B | **14,109 B** | unchanged | met |
| Response body | — | **byte-identical** | unchanged | met |

Two of the four numeric targets were missed; the latency target that gates the
next load stage was met. The response contract is provably unchanged — the
before and after payloads compare byte-for-byte identical after stripping the
per-request `timestamp` and `requestId`.

### Duplicate queries removed

Per-table statement counts for one dashboard request:

| Table | Before | After |
| --- | ---: | ---: |
| StudentGuardian | 22 | 6 |
| Enrollment | 16 | 4 |
| Guardian | 14 | 4 |
| Student | 13 | 4 |
| Section | 8 | 5 |
| Class | 8 | 5 |
| Staff | 4 | 2 |
| AcademicYear | 4 | 2 |

Three distinct causes were removed:

1. **Per-sub-service re-authorization.** Seven sub-services each called
   `assertStudentAccess`, re-issuing the student existence check and the
   guardian lookup. Now memoized per request.
2. **Per-capability guardian queries.** The capability predicate lived in the
   SQL `where`, so checking four capabilities for one child issued four
   `Guardian` + `StudentGuardian` query pairs. The relationship row is now
   fetched once without the capability filter and the same predicate is applied
   in memory against the `capabilities` scalar list.
3. **Duplicate rich student loads.** `listMyStudents` and `getAccessibleStudent`
   loaded the same student with nearly the same relations. They now share one
   include, and the list query primes the per-request cache so the selected
   child's profile lookup is a cache hit.

### Remaining cost — where the 83 statements go

The guardian/child duplication is largely gone. What remains is the eight
sub-services' own work, which this slice did not touch:

```text
transport   ~14   (route, stops, vehicle, trip, ping, assignment, enrollment)
canteen      ~7   (wallet, transactions, enrolment, meal plan, menu, servings)
activity     ~8   (posts, attachments, reactions, student tags)
fees         ~6   (invoice, lines, payment, receipt, fee head)
attendance   ~6   (sessions, records)
homework     ~4   notices ~4   auth/entitlement guards ~10
```

Reaching < 40 requires reducing the sub-services' own queries — batching the
transport lookups, collapsing the canteen wallet/transaction chain — which is a
separate bounded slice per module, not a shared-context problem.

### Verification

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm --filter @schoolos/api typecheck` | types | pass |
| `pnpm --filter @schoolos/api test` | unit | 2,348 / 2,349 pass |
| `npx jest src/mobile` | mobile unit | 106 / 106 pass |
| `npx jest src/mobile/parent-scope-context` | new scope tests | 24 / 24 pass |
| `pnpm --filter @schoolos/api test:e2e` | e2e | 275 / 283 pass |
| `pnpm db:validate` | Prisma schema | pass |
| `pnpm verify:openapi` | OpenAPI gate | pass |
| `prettier --check` (changed files) | lint | pass |

Pre-existing failures, each confirmed by stashing all changes and re-running on
unmodified `main`:

- `src/service-requests/service-requests.service.spec.ts` (1 unit test)
- `app.e2e-spec.ts`, `auth-security-hardening.e2e-spec.ts`,
  `platform.e2e-spec.ts` (8 e2e tests)

Test count rose 2,325 → 2,349; all 24 additions pass.

### Files changed

```text
apps/api/src/mobile/parent-scope-context.service.ts        new
apps/api/src/mobile/parent-scope-context.service.spec.ts   new (24 tests)
apps/api/src/mobile/mobile.service.ts                      modified
apps/api/src/mobile/mobile.module.ts                       provider registration
apps/api/src/mobile/mobile.service.spec.ts                 fixtures + 1 assertion
```

**Public API changes: none.** No route, DTO, OpenAPI, or response shape changed.

---

## Correctness check — attendance idempotency under concurrency

Not a load test, but the correctness property Scenario B is designed to stress.
Five identical `POST mobile/teacher/attendance/sync` calls with the same
`clientSubmissionId`, fired concurrently:

```text
response 1: session created,  replayed=false
response 2: replayed=true
response 3: replayed=true
response 4: replayed=true
response 5: replayed=true

SELECT count(*) FROM "AttendanceSession"
WHERE "sourceClientSubmissionId" = '<id>'   ->  no duplicate sessions
```

**Zero duplicate attendance sessions.** The `@@unique([tenantId,
sourceClientSubmissionId])` constraint plus the replay path held under
concurrent duplicate submission. Recorded in `CONCURRENCY_CORRECTNESS.md`.

---

## Not yet measured

Stated explicitly so absence is not read as a pass:

- Scenarios A, B, C (full), D, E, F
- behaviour with more than one API replica
- behaviour with workers deployed separately
- connection-pool saturation (needs the multi-replica shape)
- memory growth over a 30-minute steady-state run
- queue depth, oldest-job age, and drain behaviour under load
- GC pause distribution and event-loop delay
- Redis command latency, hit rate, and memory under load
- result-publication load (Scenario D) — requires precomputed report cards
- payment callback deduplication under concurrency
- notification fan-out duplicate suppression under load
