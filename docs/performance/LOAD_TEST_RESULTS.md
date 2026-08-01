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

## Run 7 — Teacher mobile timetable (daily-use module slice)

Chosen by measurement rather than assumption. With the auth/entitlement guard
floor at ~15 statements (`unread-count`), the per-module cost of the daily-use
endpoints was:

| Endpoint | Total stmts | Module cost |
| --- | ---: | ---: |
| **teacher timetable** | **34** | **~19** |
| parent notifications | 30 | ~15 |
| parent homework | 27 | ~12 |
| parent attendance-summary | 24 | ~9 |
| parent timetable | 24 | ~9 |
| teacher attendance classes | 19 | ~4 |

`getTeacherMobileTimetable` was the worst, and it backs three daily surfaces:
the mobile teacher timetable, `teacher-schedule.controller`, and
`teacher-today.service`. Every teacher hits it every school day, and it is part
of Scenario B (morning attendance).

### Root cause

`timetableSlotInclude()` pulls **eight relations with `true`** — every column of
each — and `substitutionInclude()` nests that whole graph again plus two full
`Staff` rows:

```text
slot query:         1 + 8 relations               =  9
substitution query: 1 + nested slot(1+8) + 2 staff = 12
staff lookup:                                       1
                                              total 22
```

Three of the eight relations (`academicYear`, `staff`, `period`) are **never
read** by this endpoint's mappers. `absentTeacher: true` / `substituteTeacher:
true` loaded another teacher's entire `Staff` row — including `panNumber`,
`bankAccount`, `citizenshipNo` — to render a display name.

### Results

Measured on `default-school`, a teacher with **22 real timetable slots**.

| Metric | Before | After | Δ |
| --- | ---: | ---: | --- |
| SQL statements / request | 34 | **20** | −41% |
| Module cost (excl. guards) | 22 | **8** | −64% |
| Throughput (c=50) | 263 rps | **369 rps** | **+40%** |
| p50 | 186 ms | **132 ms** | −29% |
| p97.5 | 212 ms | **151 ms** | −29% |
| p99 | 296 ms | **170 ms** | −43% |
| HTTP non-2xx | 0 | **0** | — |
| Response contract | — | **byte-identical** | verified |

**Statement count is O(1) in slot count.** Measured 20 statements for a teacher
with 0 slots (perf tenant) *and* 20 for a teacher with 22 slots
(`default-school`) — relation loads are batched, not per-row, so this is
genuinely set-based with no N+1.

**Contract verified against real data**, not just unit fixtures: the endpoint
was captured on `default-school` with the optimization, then the change was
stashed, the API rebuilt from unmodified `HEAD`, and the response captured
again. The two payloads compare byte-identical after stripping `timestamp` and
`requestId`.

### What changed

Two **new, purpose-limited** projections were added rather than editing the
shared helpers — `timetableSlotInclude()` has **19 call sites** whose relation
dependencies have not been audited:

| Change | Effect |
| --- | --- |
| `teacherMobileSlotSelect()` — explicit select, drops `academicYear`, `staff`, `period` | 9 → 6 statements; no whole-row fetches |
| `teacherMobileSubstitutionSelect()` — scalars only, nested slot graph removed | 12 → 1 statement in the common case |
| Substitution slots resolved from the already-loaded slot map | no second slot graph when the slot is the teacher's own |
| Slots owned by the *absent* teacher batch-fetched by id | one query, only when such substitutions exist |
| Teacher display names via one batched `Staff` findMany, `select: {id, firstName, lastName}` | replaces two full-row `Staff` includes |

Both batched id lists are deduplicated and sorted, so the generated `IN (...)`
list and its plan are stable.

### Security predicates preserved

- `staffId: staff.id` still scopes the slot query to the acting teacher;
- `tenantId` on every query including the two new batched lookups;
- version status/effective-window filter unchanged;
- substitution filter (`absentTeacherId` OR `substituteTeacherId` = me,
  non-cancelled, date range) unchanged;
- **narrower** exposure than before: other teachers' `Staff` rows are no longer
  loaded at all, only `{id, firstName, lastName}`.

A substitution whose slot cannot be resolved now degrades to `null` fields
instead of throwing — previously the nested include always materialised it.

### Files changed / tests

```text
apps/api/src/timetable/timetable.service.ts       2 new selects, batched resolution, mappers
apps/api/src/timetable/timetable.service.spec.ts  6 new tests
```

New tests: no side-lookups when there are no substitutions; `Staff` select is
name-only; substitution detail resolved from loaded slots without a second
query; absent-teacher slots batch-fetched by id; unresolvable slot degrades to
nulls; tenant + teacher scoping.

**Public API changes: none.**

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `npx jest src/timetable src/teacher-workspace src/mobile` | 260 / 260 pass |
| `npx jest src/timetable/timetable.service.spec.ts` | 11 / 11 pass |
| `pnpm --filter @schoolos/api test` | 2,464 / 2,468 pass |
| `pnpm --filter @schoolos/api test:e2e` | **283 / 283 pass** |
| `pnpm db:validate` | pass |
| `pnpm verify:openapi` | pass |
| `prettier --check` (changed files) | pass |

The 4 unit failures (`AccountingReportExportsService`, `M2AttendanceHardeningService`,
`canonical development seed`, `finance production controls`) were confirmed
pre-existing by stashing all changes and re-running on unmodified `HEAD`.

### Remaining daily-use targets

| Endpoint | Module cost | Note |
| --- | ---: | --- |
| parent notifications | ~15 | next largest daily-use cost |
| parent homework | ~12 | |
| parent attendance-summary | ~9 | |
| parent timetable | ~9 | likely the same include fan-out |

The ~12-statement auth/entitlement guard floor now dominates every one of these
and is the highest-value remaining target across the whole API — see
`PERFORMANCE_BOTTLENECKS.md` P0-1 (six `JwtAuthGuard` round-trips per request).

---

## Run 8 — Authentication/entitlement guard floor

The guard stack cost ~12 SQL statements on **every authenticated request across
all 1,345 routes**, dominating every endpoint after the module-level fixes.

### Root cause

`JwtAuthGuard` resolved the user through a four-level nested `include`
(`User → UserRole → Role → RolePermission → Permission`). Prisma emits one
round-trip per relation, so rebuilding a string array that changes only when an
administrator edits a role cost four queries per request. `include: { tenant: true }`
additionally pulled every column of both rows, including `passwordHash`.

### Results

Before/after captured on the same host, same datasets, `c=50`, 15 s, with the
change stashed and the API rebuilt from `HEAD` for the baseline.

| Endpoint | rps before | rps after | Δ | p50 before | p50 after |
| --- | ---: | ---: | --- | ---: | ---: |
| `unread-count` (guard-dominated) | 401 | **634** | **+58%** | 122 ms | **77 ms** |
| `teacher/timetable` | 263 | **536** | **+104%** | 185 ms | **89 ms** |
| `parent dashboard` | 89 | **89** | flat | 554 ms | **550 ms** |

Statements per request, measured warm:

| Endpoint | before | after |
| --- | ---: | ---: |
| **guard floor** | **12** | **7** |
| `unread-count` | 15 | **10** |
| `attendance-summary` | 24 | **19** |
| `teacher timetable` | 20 | **15** |
| `parent dashboard` | 64 | **59** |

A consistent −5 everywhere: four role/permission round-trips plus one duplicate
`Tenant` read. Zero non-2xx in every run.

The dashboard is flat because at 59 statements it is bound by its own remaining
fan-out, not by the guard — the same pattern seen in Run 5.

### Security design — what is and is not cached

Liveness is **never** cached. `User.status` and `Tenant.isActive` are read live
on every request; only the derived role/permission set moves to Redis.

Verified against a **warm cache** with the tenant state changed directly in
PostgreSQL, bypassing all application-level invalidation:

| Action | Next request |
| --- | --- |
| `UPDATE "Tenant" SET "isActive"=false` | **401** "User or tenant is inactive" |
| restore | 200 |
| `UPDATE "User" SET status='SUSPENDED'` | **401** |
| restore | 200 |

Suspension and deactivation therefore still fail closed immediately, as
`apps/api/AGENTS.md` requires — the cache cannot extend access to a
suspended tenant or a disabled account.

Redis keys are namespaced `authz:{tenantId}:{userId}` with a 300 s TTL acting
as a backstop for a missed invalidation, not as the invalidation mechanism.

### Invalidation contract

Enumerated in `AuthzCacheService`, wired and unit-tested:

| Write | Invalidation |
| --- | --- |
| `roles.service.assignPermissions` | `invalidateTenant` — every holder of the role is affected |
| `roles.service.assignRoles` | `invalidateUser` — only that user's membership changed |
| `tenants.service` provisioning | none needed — no live sessions exist yet |

A test asserts invalidation happens **after** the write, since invalidating
first would let a concurrent request re-populate from pre-write state.

### Deliberately not done

The remaining 7 guard statements are the entitlement reads
(`Tenant`, `TenantSubscription` ×2, `PlatformPlan`, `PlatformPlanFeature`,
`TenantFeatureOverride`). Caching those in Redis was **rejected for this slice**:
`EntitlementsResponse` encodes `tenant.isActive`, so a cross-request cache of it
would let a suspended tenant keep working until the TTL expired. Doing it safely
requires splitting the live suspension check from the cached plan data and
wiring the twelve tenant-config write sites listed in
`CONCURRENCY_CORRECTNESS.md` §7 — a separate bounded slice.

### Files changed / tests

```text
src/common/cache/redis-cache.service.ts    new — read-through Redis cache
src/auth/authz-cache.service.ts            new — role/permission resolution + invalidation
src/auth/authz-cache.service.spec.ts       new — 12 tests
src/auth/guards/jwt-auth.guard.ts          narrow select, cached authz, seeds tenantStatus
src/common/cache/request-cache.service.ts  seed() for same-request priming
src/roles/roles.service.ts                 invalidation at 2 write sites
test/test-helpers.ts                       rolePermission.findMany in the shared e2e stub
```

New tests cover: tenant/user key namespacing, cross-tenant and cross-user
isolation, invalidate-user vs invalidate-tenant scope, re-read after
invalidation, explicit tenant-scope bypass reason, and invalidation ordering.

**Public API changes: none.**

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `pnpm --filter @schoolos/api test` | 2,479 / 2,483 pass |
| `pnpm --filter @schoolos/api test:e2e` | **283 / 283 pass** |
| `npx jest src/auth` | 101 / 101 pass |
| `pnpm db:validate` | pass |
| `pnpm verify:openapi` | pass |

The 4 unit failures are the same pre-existing set confirmed by stashing on
unmodified `HEAD`. Unit count rose 2,468 → 2,483.

> Four e2e suites broke mid-slice and were fixed, not waived: they hand-provide
> the guard's dependencies or stub Prisma, and needed `AuthzCacheService` plus a
> `rolePermission.findMany` delegate. Several also asserted platform-override
> behaviour via a nested `userRoles` fixture that the guard no longer reads —
> those would have passed while proving nothing, so they were re-pointed at the
> new reads rather than left green.

---

## Run 9 — Entitlement half of the guard floor

Completes the guard work started in Run 8. The remaining 7 statements were the
entitlement reads: `Tenant`, `TenantSubscription` ×2, `PlatformPlan`,
`PlatformPlanFeature`, `TenantFeatureOverride`.

### The problem Run 8 deliberately deferred

`EntitlementsResponse` encodes tenant suspension — an inactive tenant returns
empty modules/features. Caching that response wholesale would let a
just-suspended tenant keep working until the entry expired, breaking the
"suspended tenants fail closed" rule.

### The split

Resolution is now two halves:

| Half | Storage | Contents |
| --- | --- | --- |
| **Live** | none — read every request | `Tenant.isActive` suspension check |
| **Cached** | Redis, 300 s TTL | subscription, plan, plan features, tenant overrides |

The live read costs nothing extra in practice: `JwtAuthGuard` already reads the
tenant row for its own liveness check and seeds it into the request cache. The
cached half depends only on tables that do not encode suspension, so a stale
entry can never widen access for a suspended tenant — the live check rejects
first.

`PlansService.checkFeatureEnabled` also dropped its separate
`TenantSubscription` existence query: `hasActiveSubscription` now rides along in
the cached state, preserving the `subscription_missing` reason exactly.

### Results

| Metric | Before | After | Δ |
| --- | ---: | ---: | --- |
| **guard floor statements** | **7** | **2** | −71% |
| `unread-count` statements | 10 | **5** | −50% |
| `attendance-summary` statements | 19 | **14** | −26% |
| `parent dashboard` statements | 59 | **54** | −8% |
| `unread-count` rps (c=50) | 634 | **835** | **+32%** |
| `teacher/timetable` rps (c=50) | 536 | **726** | **+35%** |
| `parent dashboard` rps (c=50) | 89 | **95** | +7% |
| `unread-count` p50 | 77 ms | **59 ms** | −23% |
| `teacher/timetable` p50 | 89 ms | **68 ms** | −24% |
| HTTP non-2xx | 0 | **0** | — |

The guard floor is now two statements — the `User` and `Tenant` liveness reads —
and both are irreducible without caching liveness, which this design refuses to
do.

Cumulative against the original pre-optimization baseline, `unread-count` has
gone **302 → 835 rps** and its statement count **18 → 5**.

> One measurement was discarded and re-taken: a `teacher/timetable` run reported
> 6,437 rps with 96,546 non-2xx. The 15-minute access token had expired
> mid-session, so it was benchmarking 401s. Re-authenticated and re-measured at
> 726 rps with zero non-2xx.

### Security verification (executed)

Both checks were run against a **warm** cache with state changed directly in
PostgreSQL, bypassing every application-level invalidation path.

| Scenario | Result |
| --- | --- |
| `UPDATE "Tenant" SET "isActive"=false` | next request **401**, *with the plan cache entry still present in Redis* — proving the live check rejected, not cache absence |
| restore | 200 |
| Disable `module.homework` via direct DB insert | still 200 — **stale, as documented** |
| Invalidate the plan key | **403** — module correctly blocked |
| Remove override + invalidate | 200 |

The third row is the honest cost of this design: an entitlement change written
**out of band** (direct SQL, external tooling) is invisible until invalidation or
TTL expiry. Changes made through the application always invalidate — that is the
contract below. Suspension is never affected either way.

### Invalidation contract

| Site | Action |
| --- | --- |
| `platform.service.assignSubscription` | invalidate tenant |
| `platform.service.updateSubscriptionStatus` | invalidate tenant |
| `platform.service.setFeatureOverride` | invalidate tenant |
| `platform.service.markInvoiceOverdue` (→ GRACE) | invalidate tenant |
| `platform.service.suspendTenantForBilling` | invalidate tenant |
| `platform.service.reactivateTenantAfterPayment` | invalidate tenant |
| `billing-lifecycle` overdue → GRACE | invalidate tenant |
| `billing-lifecycle` trial → EXPIRED | invalidate tenant |
| `billing-lifecycle` grace → SUSPENDED | invalidate tenant |
| `billing-lifecycle` renewal (`renewsAt` only) | **none** — not part of the cached projection, noted in code |
| `Tenant.isActive` writes | **none needed** — suspension is live |

`invalidateAllTenantEntitlements()` exists for `PlatformPlanFeature` edits,
which would affect every tenant on a plan. **No caller today** — the codebase has
no plan-feature mutation surface (plans are seeded). It is provided so a future
plan-editing feature has the correct primitive rather than inventing one.

### Files changed / tests

```text
src/plans/entitlements.service.ts          live/cached split + invalidation API
src/plans/plans.service.ts                 subscription presence from cached state
src/platform/platform.service.ts           6 invalidation sites
src/platform/platform-billing-lifecycle.service.ts  3 sites + 1 documented non-site
src/plans/plans.service.spec.ts            7 new tests
```

New tests: plan cached across calls while suspension is re-read every time;
fails closed on suspension with a warm cache; restores on reactivation; re-reads
after invalidation; tenant-scoped vs global invalidation keys;
`hasActiveSubscription` never leaks into the public response;
`subscription_missing` without a separate query.

**Public API changes: none.**

### Verification

| Command | Result |
| --- | --- |
| `pnpm --filter @schoolos/api typecheck` | pass |
| `pnpm --filter @schoolos/api test` | 2,486 / 2,490 pass |
| `pnpm --filter @schoolos/api test:e2e` | **283 / 283 pass** |
| `npx jest src/plans` | 29 / 29 pass |
| `pnpm db:validate` | pass |
| `pnpm verify:openapi` | pass |

The 4 unit failures are the same pre-existing set confirmed by stashing on
unmodified `HEAD`. Unit count rose 2,483 → 2,490.

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
