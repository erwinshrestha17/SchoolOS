# SchoolOS — Load Test Plan

Companion to `ONE_SCHOOL_CONCURRENCY_TARGET.md` (targets) and
`LOAD_TEST_RESULTS.md` (what has actually been run).

Harness: `tests/load/` — see `tests/load/README.md` for setup and commands.

---

## 1. Dataset

All scenarios run against the isolated `perf-school` tenant produced by
`apps/api/prisma/seed-performance-tenant.ts`:

| Entity | Seeded volume |
| --- | --- |
| Students | 1,500 |
| Parent accounts | 3,000 (2 guardians per student, all capabilities granted) |
| Teachers | 50 (each with homeroom + subject `TeacherAssignment` rows) |
| Admin / leadership | 15 |
| Classes × sections | 12 × 3 = 36 |
| Subjects | 72 |
| Attendance sessions | 7,920 (220 school days × 36 sections) |
| Attendance records | 330,000 |
| Notification deliveries | 36,000 |

Attendance status mix is ~94% present / 4% absent / 2% late, and school days
skip the weekly closed day, so date-range queries see a realistic distribution
rather than a uniform block.

Data generation is deterministic (seeded PRNG), so two runs compare like for
like.

---

## 2. Environment requirements

| Requirement | Reason |
| --- | --- |
| Load generator on a **separate host** from the API | co-located generators cap results — see `BASELINE_RESULTS.md` §1 |
| API in the target multi-replica shape behind a load balancer | single-replica results cannot be extrapolated |
| Workers deployed separately from API replicas | otherwise heavy jobs distort request latency |
| Fresh seed before each headline run | avoids drift from previous runs' writes |
| Observability capturing API/PG/Redis/queue metrics | required to identify the bottleneck, not just observe it |

A run that does not meet these cannot produce a capacity claim. It can still
produce a valid **relative** comparison, which must be labelled as such.

---

## 3. Scenarios

All are in `tests/load/k6/scenarios.js`, selected with `-e SCENARIO=<letter>`.

### S — Smoke (harness validation)

5 VUs, 1 minute. Not a performance test. Confirms every workflow authenticates
and every endpoint path is correct before spending time on a long run.

```bash
k6 run -e SCENARIO=S tests/load/k6/scenarios.js
```

### A — Normal day

200 concurrent users for 30 minutes: 170 parents, 20 teachers, 10 admins.
Establishes steady-state behaviour and is the run to watch for memory growth
and queue backlog accumulation.

### B — Morning attendance

300 parents + 50 teachers + 10 admins, 15 minutes. The teachers all execute the
attendance workflow, which is the heaviest concurrent write in the product.

Teacher workflow:

```text
login / refresh
GET  mobile/teacher/timetable
GET  mobile/teacher/attendance/classes      assigned scope
GET  mobile/teacher/attendance/roster       today's roster
POST mobile/teacher/attendance/sync         submit
POST mobile/teacher/attendance/sync         retry, SAME clientSubmissionId
```

The repeated submit is deliberate: it exercises the offline-retry path. A
correct implementation replays the original receipt and creates no second
session.

Parent workflow: bootstrap, attendance, notifications, homework.

### C — Evening parent peak

500 concurrent parents, 20 minutes. Read-dominated:

```text
bootstrap -> attendance summary -> homework -> timetable -> notices
          -> fee summary -> notifications
```

### D — Result publication

750 concurrent parents, 15 minutes. The peak-load scenario:

```text
open result notification -> result summary -> subject breakdown
-> request report-card URL -> file download authorization
```

Precondition: results must be **published and precomputed** before the run.
Testing on-demand generation measures the wrong thing — the production design
requires report cards to exist before publication (see
`ONE_SCHOOL_CONCURRENCY_TARGET.md` and the precompute work item).

### E — Required concurrency test

**1,000 concurrent users, 20 minutes** — the run that gates the readiness
claim. Mix: 700 parents opening the app, 200 parents browsing, 70 teachers
submitting attendance, 30 admins.

All acceptance thresholds from the target document apply.

### F — Failure boundary

Ramp 500 → 1,000 → 1,250 → 1,500, then down to 0 to observe recovery.
Thresholds are intentionally not asserted; the purpose is to locate:

- the first bottleneck and the saturation point
- how latency degrades approaching it
- the failure mode (shed load vs. errors vs. stall)
- recovery behaviour after the spike
- database correctness afterwards
- queue drain behaviour

**Do not run F until E is stable.**

---

## 4. Execution order

Run in ascending order, never skipping ahead:

```text
50 -> 100 -> 200 -> 300 -> 500 -> 750 -> 1,000 -> 1,500 boundary
```

At each stage record:

1. infrastructure configuration (replicas, pool sizes, worker counts)
2. dataset version
3. traffic mix
4. p50 / p95 / p99 per tagged endpoint
5. throughput
6. error rate and error classes
7. API CPU and memory
8. database connection usage and pool waits
9. slow queries
10. queue depth, oldest waiting job, failure count
11. the identified first bottleneck

Then: **fix one bounded issue, rerun the same stage, compare.** Do not increase
load while a known correctness failure is outstanding.

---

## 5. Acceptance thresholds encoded in the harness

`ACCEPTANCE_THRESHOLDS` in `tests/load/k6/lib/config.js` asserts:

```text
http_req_failed                               rate < 0.005
checks                                        rate > 0.995
http_req_duration                             p95 < 800 ms
http_req_duration{name:auth/login}            p95 < 2000 ms
http_req_duration{name:parent/bootstrap}      p95 < 800 ms
http_req_duration{name:attendance/submit}     p95 < 1000 ms
```

Requests are tagged by logical endpoint (`parent/bootstrap`,
`attendance/submit`, …) rather than by URL, so percentiles group correctly
despite student ids in paths.

Thresholds not yet automated, to be verified out-of-band per run:

- database pool exhaustion = 0
- deadlocks = 0
- duplicate attendance rows = 0
- duplicate payment postings = 0
- cross-tenant exposure = 0
- unbounded queue growth = none
- memory growth = none

---

## 6. Correctness verification after every write-heavy run

```sql
-- duplicate attendance sessions for one class/section/date
SELECT "tenantId", "attendanceDate", "classId", "sectionId", count(*)
FROM "AttendanceSession"
GROUP BY 1,2,3,4 HAVING count(*) > 1;

-- duplicate attendance records within a session
SELECT "attendanceSessionId", "studentId", count(*)
FROM "AttendanceRecord"
GROUP BY 1,2 HAVING count(*) > 1;

-- replayed submissions that created a second session
SELECT "sourceClientSubmissionId", count(*)
FROM "AttendanceSession"
WHERE "sourceClientSubmissionId" IS NOT NULL
GROUP BY 1 HAVING count(*) > 1;

-- rows outside the performance tenant (cross-tenant leakage from the run)
SELECT count(*) FROM "AttendanceSession"
WHERE "tenantId" <> '<perf-tenant-id>' AND "createdAt" > '<run start>';
```

All must return zero rows.

> Note: several existing web E2E specs write into the shared demo tenant. Load
> runs must target `perf-school` only — check the last query above after every
> run to confirm nothing leaked.
