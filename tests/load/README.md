# SchoolOS load-test harness

Scenario definitions and acceptance criteria live in
`docs/performance/LOAD_TEST_PLAN.md` and
`docs/performance/ONE_SCHOOL_CONCURRENCY_TARGET.md`. This file covers how to run
things.

```text
tests/load/
  k6/
    scenarios.js        scenarios A–F plus a smoke scenario, selected with SCENARIO
    lib/config.js       base URL, seeded population, login, tagged helpers, thresholds
    lib/workflows.js    persona workflows (parent bootstrap, browse, result day, teacher, admin)
  run-ramp.sh           single-endpoint concurrency ramp using autocannon
  results/              run output (git-ignored)
```

## Prerequisites

```bash
brew install k6            # k6 v2.x
npm i -g autocannon        # only needed for run-ramp.sh
docker compose up -d postgres redis
```

## 1. Seed an isolated performance tenant

Never load-test an empty database, and never load-test the development or
production tenant. The generator creates its own tenant (`perf-school`).

```bash
pnpm db:seed:performance
```

Defaults: 1,500 students, 3,000 parents, 50 teachers, 15 admins, 12 classes ×
3 sections, 220 attendance days (~330,000 attendance records), 36,000
notifications. Takes about 30 s.

Override any dimension for a quicker dataset:

```bash
PERF_STUDENTS=200 PERF_ATTENDANCE_DAYS=20 pnpm db:seed:performance
```

Re-running is idempotent — structure is refreshed, bulk data is topped up to
target rather than duplicated. `PERF_RESET=1` purges this tenant's bulk data
first.

Seeded credentials (synthetic fixture tenant only):

```text
parent00001@perf-school.test .. parent03000@perf-school.test
teacher001@perf-school.test  .. teacher050@perf-school.test
admin001@perf-school.test    .. admin015@perf-school.test
password: LoadTest123!            (override with PERF_PASSWORD)
```

## 2. Start the API

```bash
pnpm --filter @schoolos/api build
node apps/api/dist/apps/api/src/main.js
```

## 3. Run a scenario

```bash
# validate the harness first — 5 VUs, 1 minute
k6 run -e SCENARIO=S tests/load/k6/scenarios.js

# scenarios
k6 run -e SCENARIO=A tests/load/k6/scenarios.js   # normal day, 200 VUs, 30m
k6 run -e SCENARIO=B tests/load/k6/scenarios.js   # morning attendance
k6 run -e SCENARIO=C tests/load/k6/scenarios.js   # evening parent peak, 500
k6 run -e SCENARIO=D tests/load/k6/scenarios.js   # result publication, 750
k6 run -e SCENARIO=E tests/load/k6/scenarios.js   # required 1,000-user mix
k6 run -e SCENARIO=F tests/load/k6/scenarios.js   # failure boundary, ramp to 1,500
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PERF_BASE_URL` | `http://localhost:4000` | API origin |
| `PERF_TENANT_SLUG` | `perf-school` | must match the seeded tenant |
| `PERF_PASSWORD` | `LoadTest123!` | must match the seed |
| `PERF_PARENT_COUNT` / `PERF_TEACHER_COUNT` / `PERF_ADMIN_COUNT` | 3000 / 50 / 15 | must match the seed, or VUs authenticate as non-existent accounts |
| `DURATION` | per scenario | override run length |
| `VU_SCALE` | `1` | scale all VU counts — **rehearsal only** |

> `VU_SCALE < 1` does **not** run that scenario. Use it to validate the harness
> or observe the shape of the curve on constrained hardware; never report a
> scaled run against the acceptance criteria.

## 4. Single-endpoint ramp

Useful for isolating one endpoint while bisecting a regression:

```bash
export PERF_ACCESS_TOKEN=<token>
tests/load/run-ramp.sh /api/v1/mobile/me/dashboard 15 "10 25 50 100 200"
```

Writes a TSV summary and raw autocannon JSON to `tests/load/results/`.

## Where the load generator runs

Running k6 on the same host as the API makes the two compete for CPU and caps
the achievable numbers. That is acceptable for **relative** measurements
(before/after a change) and it is how the current baseline was captured — see
the limitations section of `docs/performance/BASELINE_RESULTS.md`.

For any run whose numbers will be quoted as capacity, the load generator must
be on a separate host from the API, and the API must be deployed in the target
multi-replica shape.

## Counting queries per request

The most useful diagnostic in this codebase so far. Prisma uses the extended
query protocol, so statements appear as `execute <unnamed>`, not `statement:`.

```bash
docker exec schoolos_postgres psql -U schoolos -d schoolos_db \
  -c "alter system set log_statement='all';" -c "select pg_reload_conf();"

# issue the request, then:
docker logs schoolos_postgres 2>&1 | grep -c "execute <unnamed>"

docker exec schoolos_postgres psql -U schoolos -d schoolos_db \
  -c "alter system set log_statement='none';" -c "select pg_reload_conf();"
```

Always turn logging back off before measuring latency — it distorts results
badly.
