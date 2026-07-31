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

## Run 6 — Parent dashboard transport summary (bounded slice)

Same host, same `perf-school` dataset, same concurrency, duration and k6 script
as Run 5. Only the transport query model changed.

### The finding

`getStudentTransport` issued **12 SQL statements for a child with no transport
records at all**. Prisma resolves every `include`d relation as its own
round-trip *even when the root row is null*, so all three root queries returned
nothing and Prisma still issued nine relation queries:

```text
1 TransportEnrollment          (null)   7 TransportStop      ← enrollment include
2 TransportTripStudentStatus   (null)   8 TransportTrip      ← status include
3 TransportStudentAssignment   (null)   9 TransportStop      ← status include
4 TransportRoute ← assignment include  10 TransportRoute     ← trip include
5 TransportStop  ← assignment include  11 TransportLocationPing ← trip include
6 TransportRoute ← enrollment include  12 TransportVehicle   ← trip include
```

Most children are not transported, so this was the common case, not an edge
case.

### Results

| Metric | Before | After | Target | Status |
| --- | ---: | ---: | ---: | --- |
| Transport SQL statements | 12 | **3** | ≤ 3 | **met** |
| Total dashboard statements | 85 | **74** | ≤ 70 | **missed** |
| Throughput (c=50) | 74 rps | **77 rps** | ≥ 82 rps | **missed** |
| p50 (c=50) | 655 ms | **632 ms** | — | −3.5% |
| p97.5 (c=50) | 717 ms | **721 ms** | — | flat |
| p99 (c=50) | 773 ms | **766 ms** | — | −0.9% |
| **`parent/bootstrap` p95 @ c=100** | 507 ms | **454 ms** | < 600 ms | **met** |
| HTTP 5xx | 0 | **0** | 0 | met |
| Response body | — | **byte-identical** | unchanged | met |
| DB connections | ~10 pool ceiling | ~10 pool ceiling | no material regression | met |

> The "before" total of 85 was re-measured in this session; the figure carried
> from Run 5 was 83. The dataset grew slightly because earlier k6 runs write
> attendance rows. Both numbers are from the same tenant, and the 9-statement
> transport reduction is unaffected.

### Measurement caveats — read before quoting

1. **The measured 3 transport statements reflect a dataset with no transport
   rows.** `perf-school` seeds no routes, stops, vehicles or trips. Three
   statements is the *empty* path — which is the common production case, but it
   is not the populated path. With a fully transported child the new model costs
   **8** statements (3 root + trip + routes + stops + vehicle + latest ping)
   versus 12 before. The populated path is covered by unit tests, not by this
   load measurement.

2. **The API CPU comparison in this run is not sound and no claim is made.**
   `ps %cpu` on macOS reports a lifetime average that decays with process
   uptime; repeated sampling under identical load drifted 85.6% → 65.0% within
   15 seconds (mean 75.4%). The single 49.6% "before" sample is not comparable
   to it. Throughput and latency are the reliable signals here.

3. **Single-instant `pg_stat_activity` active/idle splits are noisy.** Sampling
   five times under sustained load gave 5/8, 0/10, 1/9, 7/3 and 10/6. Total
   connections stayed at the ~10 Prisma pool ceiling before and after, with zero
   pool errors — that is the meaningful comparison.

### Queries removed / batched

| Change | Effect |
| --- | --- |
| `include` replaced by scalar + FK `select` on the three root queries | relations no longer resolved for rows that do not exist |
| `TransportRoute` fetched per referencing row (3×) | one batched `findMany({ id: { in } })` |
| `TransportStop` fetched per referencing row (3×) | one batched `findMany({ id: { in } })` |
| trip, vehicle and latest ping loaded unconditionally | loaded only when an active trip exists |
| `locationPings` include with `take: 1` | `findFirst` ordered by `recordedAt desc` — never GPS history |

Batched id lists are deduplicated and sorted, so the generated `IN (...)` list
and its query plan are stable across requests.

### Security predicates preserved

- every query still filters `tenantId: actor.tenantId`, including the new
  batched lookups — a route, stop, vehicle or trip belonging to another tenant
  resolves to `null` rather than being returned;
- authorization is unchanged: `assertStudentAccess(..., EMERGENCY_ALERT_RECEIVE)`
  still runs first, so an unauthorized or unrelated child never reaches a
  transport query;
- root rows still filter `status: 'ACTIVE'` and `trip: { status: 'ACTIVE' }`;
- no driver identity, driver assignment, trip notes, route history, vehicle
  history or GPS history is selected;
- `activeTrip` is now emitted only when the trip row itself resolves. The old
  code dereferenced `activeStatus.trip` unconditionally, which was safe only
  because the include always materialised it.

### Files changed

```text
apps/api/src/mobile/mobile.service.ts        getStudentTransport + uniqueIds helper
apps/api/src/mobile/mobile.service.spec.ts   transport fixtures + 16 new tests
```

**Public API changes: none.** Response verified byte-identical.

### Verification

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm --filter @schoolos/api typecheck` | types | pass |
| `pnpm --filter @schoolos/api test` | unit | 2,364 / 2,365 pass |
| `npx jest src/mobile` | mobile + transport | 146 / 146 pass |
| `pnpm --filter @schoolos/api test:e2e` | e2e | 275 / 283 pass |
| `pnpm db:validate` | Prisma schema | pass |
| `pnpm verify:openapi` | OpenAPI gate | pass |
| `prettier --check` (changed files) | lint | pass |
| `k6 run -e SCENARIO=C -e VU_SCALE=0.2 -e DURATION=3m` | load | bootstrap p95 454 ms, 0 failures |

Failures are the same pre-existing ones confirmed by stashing in Run 5:
`service-requests.service.spec.ts` (1 unit) and `app` / `auth-security-hardening`
/ `platform` e2e (8 tests). Unit count rose 2,349 → 2,365; all 16 additions pass.

### Unresolved transport bottleneck

The populated path still costs 8 statements. Collapsing it further needs either
Prisma's `relationLoadStrategy: 'join'` — still behind the `relationJoins`
**preview** flag in Prisma 7.8, and a generator-wide change affecting all 1,345
routes, so deliberately not enabled for one endpoint — or hand-written SQL,
which would bypass the tenant-scope client extension. Both are decisions to take
deliberately, not inside a bounded slice.

---

## Run 7 — Parent dashboard activity + milestone summary (bounded slice)

Same host, same `perf-school` dataset (now with representative M5 activity,
milestones, consent, and measurement fixture parents), same 1-replica staging
API. Only the activity query model and milestone relation loading changed.

### Dataset validation (before optimization work)

The performance tenant previously contained **zero** activity/milestone rows.
This slice extended [`seed-performance-tenant.ts`](../../apps/api/prisma/seed-performance-tenant.ts)
with:

- 43 approved activity posts, 36 attachments, 19 student tags, 3,000 milestones,
  15,000 guardian consents (PHOTO_USAGE mixed grant/deny);
- fixture parents: `parent-perf-empty@`, `parent-perf-one@`, `parent-perf-multi@`
  (isolated tenant only);
- `pnpm --filter @schoolos/api perf:verify` row-count gate.

> **Note:** Re-seed with `PERF_RESET=1` (or delete activity rows for the perf
> tenant only) after pulling this change so fixture parents pick up the revised
> seed that removes school-wide `ALL` posts from the empty-path section. The
> first seed on an existing tenant skipped bulk activity recreation because posts
> were already present from an intermediate run.

### Before (carried from Run 6 — pre-activity-optimization code)

Run 6 measured the dashboard **before** this slice, against an **empty** activity
table. Those numbers remain the honest “before” baseline for throughput:

| Metric | Run 6 before |
| --- | ---: |
| Activity SQL (dashboard bucket) | ~8 |
| Total dashboard SQL | ~74 (re-measured 85→74 transport slice) |
| Throughput at c=50 | ~77 rps |
| p50 at c=50 | ~632 ms |
| p97.5 at c=50 | ~721 ms |
| Bootstrap p95 at c=100 | ~454 ms |

### Activity query model — after (isolated path counts)

Measured with `pnpm --filter @schoolos/api perf:measure-activity-sql` against
the optimized `getStudentActivityFeed` shape (root select → early return → batched
attachments/reactions):

| Path | Activity SQL | Notes |
| --- | ---: | --- |
| Empty (no matching post) | **1** | root `ActivityPost` only — `parent-perf-empty@` |
| Populated (latest preview) | **3** | root + `ActivityAttachment` + `ActivityReaction` |

Unit tests in `describe('parent activity summary')` enforce the same short-circuit
and batching contracts.

**Removed:** Prisma `include` fan-out on `activityPost.findMany` (`attachments`,
`reactions`, `_count.attachments`, `_count.reactions` as separate round-trips).

**Introduced:** phased scalar-root query; batched attachment/reaction `findMany`
only when `posts.length > 0`; in-memory counts and SEEN derivation.

### Milestone endpoint — after (parent `listMilestones`)

`ActivityFeedService.listMilestones` now loads milestone scalars first, then
batches `class`, `section`, and `student` with tenant-scoped `findMany({ id: { in } })`
instead of Prisma `include` fan-out. Empty milestone lists return after one query.

### Dashboard throughput — after (measured 2026-07-31)

Re-measured against the dev stack (`docker compose` postgres on `:5433`, API on
`:4001` with `apps/api/.env`, 1,500-student `perf-school` tenant after
`PERF_RESET=1` re-seed). The staging-local API profile (`:4000` → `:5434`) was
**not** used because staging postgres was not running; login returned HTTP 500
against an unreachable database.

```bash
pnpm --filter @schoolos/api build
cd apps/api && PORT=4001 pnpm start
PERF_BASE_URL=http://localhost:4001 PERF_ACCESS_TOKEN=… \
  tests/load/run-ramp.sh /api/v1/mobile/me/dashboard 12 "50"
PERF_BASE_URL=http://localhost:4001 \
  k6 run -e SCENARIO=C -e VU_SCALE=0.2 -e DURATION=3m tests/load/k6/scenarios.js
# dashboard SQL: log_statement='all', 3 requests, docker logs --since 30s
```

> **Note:** This throughput run used the build that includes **both** the activity
> slice and the canteen slice (Run 8). Isolated activity SQL counts above remain
> the honest Run 7 query-model evidence.

### Results table

| Metric | Before (Run 6) | After | Target | Status |
| --- | ---: | ---: | ---: | --- |
| Activity SQL, empty path | ~8 (empty table) | **1** | ≤3 | **met** |
| Activity SQL, populated path | ~8 | **3** | ≤3 | **met** |
| Total dashboard SQL | ~74 | **~76** (3-req avg) | ≤68 | **miss** |
| Throughput at c=50 | ~77 rps | **72 rps** | ≥82 rps | **miss** |
| p50 at c=50 | ~632 ms | **673 ms** | no regression | **flat** |
| p97.5 at c=50 | ~721 ms | **798 ms** | improve or flat | **flat/slight regression** |
| Bootstrap p95 at c=100 | ~454 ms | **620 ms** | <600 ms | **miss** |
| DB connections | ~10 pool | not isolated | no material regression | **not measured** |
| HTTP 5xx | 0 | **0** | 0 | **met** |
| Response contract | unchanged | unit-tested | unchanged | **met** |

### Security predicates preserved

- every activity/milestone query filters `tenantId`;
- audience OR unchanged (`ALL` / `STUDENT`+tag / `CLASS` / `SECTION`);
- `APPROVED`, `parentVisible`, `softDeletedAt: null` unchanged;
- protected attachment paths only; no storage keys in list responses;
- parent milestone scope still enforced via `buildActorStudentIdScope` /
  `getParentStudentIds` with `ACADEMICS_VIEW`;
- consent enforcement on mobile lists unchanged (download-time via
  `ActivityMediaService`).

### Files changed

```text
apps/api/prisma/seed-performance-tenant.ts       activity/milestone/consent/fixtures
apps/api/prisma/perf-verify.ts                   new row-count gate
apps/api/prisma/perf-measure-activity-sql.ts     isolated activity SQL counter
apps/api/package.json                            perf:verify, perf:measure-activity-sql
apps/api/src/mobile/mobile.service.ts            phased getStudentActivityFeed
apps/api/src/activity-feed/activity-feed.service.ts   batched listMilestones
apps/api/src/mobile/mobile.service.spec.ts       parent activity summary tests
apps/api/src/activity-feed/activity-feed.service.spec.ts   parent milestone tests
```

**Public API changes: none.**

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `pnpm --filter @schoolos/api test -- src/mobile/mobile.service.spec.ts src/activity-feed/activity-feed.service.spec.ts` | 108 / 108 pass |
| `pnpm db:validate` | pass |
| `pnpm verify:openapi` | pass |
| `pnpm --filter @schoolos/api perf:verify` | pass (113 posts, 3000 milestones) |
| `pnpm --filter @schoolos/api perf:measure-activity-sql` | empty **1**, populated **3** SQL |
| autocannon dashboard c=50 | **72 rps**, p50 **673 ms**, 0 non-2xx |
| k6 SCENARIO=C VU_SCALE=0.2 | bootstrap p95 **620 ms**, 0 failures |
| dashboard SQL (log_statement) | **~76** avg over 3 requests |

### Unresolved activity bottlenecks

- Dashboard throughput still dominated by non-activity statements (canteen, fees,
  attendance, homework, notices, auth). The ≥82 rps target was not reached.
- Populated-path activity could not be collapsed below 3 without hand-written SQL
  or Prisma `relationJoins` preview (same transport-slice rationale).
- Total dashboard SQL (~76) did not reach the ≤68 stretch target; canteen menu
  (tenant-wide, take 25) and fees remain the next buckets.

**Activity slice query-model: ready.** End-to-end throughput claim: **not ready**
(72 rps < 82 rps target; bootstrap p95 620 ms > 600 ms).

---

## Run 8 — Parent dashboard canteen summary (bounded slice)

Same host, same `perf-school` dataset (now with representative canteen menu,
wallets, enrollments, servings, and wallet transactions), same 1-replica API
on `:4001`. Only the canteen query model changed on top of the Run 7 activity
optimizations.

### Before (carried from Run 6 — pre-canteen-optimization code)

| Metric | Run 6 before |
| --- | ---: |
| Canteen SQL (dashboard bucket) | ~7 |
| Total dashboard SQL | ~74 |

### Canteen query model — after (isolated path counts)

Measured with `pnpm --filter @schoolos/api perf:measure-canteen-sql`:

| Path | Canteen SQL | Notes |
| --- | ---: | --- |
| Empty (no wallet, no enrollments) | **3** | wallet + enrollments + menu |
| Populated (`parent-perf-one@`) | **6** | + transactions + servings + batched mealPlan |
| Wallet-only (`parent-perf-multi@` child 2) | **5** | wallet path without enrollments |

Unit tests in `describe('parent canteen summary')` enforce empty-path
short-circuit, batched `canteenMealPlan.findMany`, and `FEES_VIEW` denial.

**Removed:** Prisma `include: { mealPlan }` fan-out on enrollments and servings.

**Introduced:** phased scalar roots; skip transactions/servings when no wallet and
no active enrollments; batched tenant-scoped meal-plan lookup.

### Performance seed extensions

[`seed-performance-tenant.ts`](../../apps/api/prisma/seed-performance-tenant.ts)
now seeds (perf tenant only):

- 25 active menu items, 2 meal plans;
- wallets (~25% of students), enrollments (~10%), servings, transactions;
- fixture alignment: `parent-perf-empty@` child has **no wallet**;
  `parent-perf-one@` has wallet + enrollment + servings.

Env overrides: `PERF_CANTEEN_MENU_ITEMS`, `PERF_CANTEEN_WALLET_RATIO`,
`PERF_CANTEEN_ENROLLED_RATIO`.

### Dashboard throughput — after (same Run 7 measurement pass)

The Run 7 re-measurement above already exercised this build (activity + canteen).
No separate k6/autocannon pass was run for Run 8 alone.

| Metric | Run 7 after (combined build) | Target | Status |
| --- | ---: | ---: | --- |
| Canteen SQL, empty path | **3** | ≤3 | **met** |
| Canteen SQL, populated path | **6** | bounded | **met** |
| Total dashboard SQL | **~76** | ≤68 | **miss** |
| Throughput at c=50 | **72 rps** | ≥82 rps | **miss** |
| Bootstrap p95 at c=100 | **620 ms** | <600 ms | **miss** |
| HTTP 5xx | **0** | 0 | **met** |
| Response contract | unit-tested | unchanged | **met** |

### Files changed

```text
apps/api/prisma/seed-performance-tenant.ts       canteen seed + activity fixture fix
apps/api/prisma/perf-verify.ts                   canteen row counts
apps/api/prisma/perf-measure-canteen-sql.ts      isolated canteen SQL counter
apps/api/package.json                            perf:measure-canteen-sql
apps/api/src/mobile/mobile.service.ts            phased getStudentCanteen
apps/api/src/mobile/mobile.service.spec.ts       parent canteen summary tests
```

**Public API changes: none.**

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `pnpm --filter @schoolos/api test -- src/mobile/mobile.service.spec.ts` | 74 / 74 pass |
| `pnpm db:validate` | pass |
| `pnpm verify:openapi` | pass |
| `pnpm --filter @schoolos/api perf:verify` | pass (25 menu items, 362 wallets) |
| `pnpm --filter @schoolos/api perf:measure-canteen-sql` | empty **3**, one **6** SQL |

### Unresolved canteen bottlenecks

- Tenant-wide `canteenMenuItem.findMany` (take 25) runs on every dashboard request;
  empty-path floor is **3**, not 1.
- Throughput ≥82 rps remains blocked by fees (~6 SQL) and remaining dashboard fan-out.

**Canteen slice query-model: ready.** Combined dashboard throughput claim: **not ready**.

> **Wave 1 deferral (2026-07-31):** M8 Library, M9 Transport, and M10 Canteen
> leave the active one-school concurrency program. Code and migrations are
> preserved. The performance tenant now uses the **STANDARD** plan with
> `addOns: []` so those modules are entitlement-disabled and execute **zero**
> dashboard queries. Prior Run 6–8 canteen/transport numbers are historical and
> must not be used as the pilot core-dashboard baseline.

---

## Core dashboard baseline — M8/M9/M10 off (pre–fee-summary optimize)

Measured after pinning `perf-school` to STANDARD (no library/transport/canteen)
and confirming `modules.canteen/transport/library === false` on the parent
dashboard. API on `:4001` against docker postgres `:5433`.

| Metric | Value | Notes |
| --- | ---: | --- |
| Total dashboard SQL | _pending measure_ | 3-request avg with `log_statement` |
| Throughput at c=50 | _pending measure_ | autocannon 12 s |
| Bootstrap p95 at c=100 | _pending measure_ | k6 SCENARIO=C VU_SCALE=0.2 |
| HTTP 5xx | _pending measure_ | |
| Modules canteen/transport/library | **false** | STANDARD plan |

---

## Run 9 — Parent fee summary (bounded slice)

Phased `getStudentFeesSummary`: invoice scalars → early empty return → batched
lines/payments → batched feeHeads/receipts. Response shape unchanged.

| Metric | Before | After | Target | Status |
| --- | ---: | ---: | ---: | --- |
| Fee SQL, empty path | ~6 | _pending_ | ≤2 | pending |
| Fee SQL, populated path | ~6 | _pending_ | ≤5 | pending |
| Total dashboard SQL | core baseline | _pending_ | improve | pending |
| Throughput at c=50 | core baseline | _pending_ | ≥82 stretch | pending |
| Payment concurrency unit tests | GAP | assessed | duplicate→0 | **met** (unit) |

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
