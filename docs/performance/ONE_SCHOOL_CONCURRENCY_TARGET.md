# SchoolOS — One-School Concurrency Target

Status: **active target definition**
Owner: backend / performance
Created: 2026-07-31

This document defines the single authoritative capacity target for SchoolOS. It
is the contract every load test, acceptance check, and readiness claim in
`docs/performance/` is measured against.

---

## 1. Deployment shape (fixed for this program)

```text
One school
One tenant
One PostgreSQL database
One Redis instance
One SchoolOS deployment
Multiple stateless API replicas
Separate background workers
```

Explicitly **out of scope** and not to be implemented under this program:

- `cellId` or any cell-routing column/abstraction
- multiple cells, database-per-school, database routing
- splitting the modular monolith into microservices
- Kafka or any additional broker without a measured, documented need
- enabling Chat (M13/M14 remain deferred and frozen)
- widening the controlled-pilot scope

SchoolOS must remain *architecturally capable* of multi-tenant operation — the
`tenantId` boundary, entitlement gating, and persona scoping all stay intact —
but no multi-tenant scaling machinery is built now.

---

## 2. Target school size

| Population | Count |
| --- | --- |
| Students | up to 1,500 |
| Parent accounts | up to 3,000 |
| Teachers | ~50 |
| Admin + leadership | ~15 |
| **Total registered accounts** | **~3,065** |

Structural scale that follows from the above:

| Entity | Expected volume |
| --- | --- |
| Classes / sections | 30–40 |
| Attendance days retained | 220 (one academic year) |
| Attendance rows | ~330,000 (1,500 × 220) |
| Fee invoices | ~18,000 (1,500 × 12 monthly cycles) |
| Notifications | 6-figure over a year |

---

## 3. Concurrency and throughput targets

```text
Normal concurrent users:       100–250
Busy-period concurrent users:  300–500
Peak concurrent users:         750
Required load test:            1,000 concurrent users
Failure-boundary test:         ramp toward 1,500 concurrent users
```

```text
Sustained throughput: 100–200 requests per second
Short burst:          300–500 requests per second
```

"Concurrent users" means virtual users with realistic think time, not
simultaneous in-flight requests. The traffic mix is defined per scenario in
`LOAD_TEST_PLAN.md`.

---

## 4. Acceptance criteria

SchoolOS may be described as **one-school concurrency ready** only after the
1,000-concurrent-user test (Scenario E) meets *all* of the following:

### Latency and availability

| Metric | Threshold |
| --- | --- |
| Request success rate | ≥ 99.5% |
| HTTP 5xx rate (normal operation) | < 0.5% |
| Login p95 | < 2 s |
| Parent bootstrap p95 | < 800 ms |
| Cached read p95 | < 250–300 ms |
| Normal database read p95 | < 500 ms |
| Normal API p95 | < 800 ms |
| Attendance submission p95 | < 1 s |
| Heavy async request acceptance p95 | < 500 ms |

### Correctness and resource safety

| Metric | Threshold |
| --- | --- |
| Database pool exhaustion events | 0 |
| Deadlocks | 0 |
| Lost confirmed writes | 0 |
| Duplicate attendance records | 0 |
| Duplicate payment postings | 0 |
| Cross-tenant data exposure | 0 |
| Unbounded queue growth | 0 |
| Continuous memory growth | none |
| Automatic recovery after spike | required |

### Connection budget

```text
Normal usage:  below 60% of safe connection capacity
Peak usage:    below 80% of safe connection capacity
Pool exhaustion: exactly zero
```

---

## 5. Degradation policy at 1,500 users

At the failure-boundary stage, **graceful degradation is acceptable**:
elevated latency, shed load, 429/503 responses, and queue backlog that drains
after the spike.

The following are **never acceptable at any load**:

- data corruption
- cross-tenant leakage
- lost confirmed writes
- duplicate financial entries
- unrecoverable queue failure

---

## 6. Invariants that performance work must not break

Every change made under this program preserves:

- tenant isolation (`tenantId` on every tenant-owned read/write/job/file path)
- role-based authorization and the teacher assignment-scope model
- parent–child scope and guardian capability gating
- existing public API contracts where practical
- migration safety
- auditability of sensitive writes
- offline correctness for the mobile attendance flow
- financial correctness (idempotent money writes, reversal/correction model)
- notification correctness (no duplicate parent alerts)

Password hashing strength must not be reduced to buy throughput.

---

## 7. Readiness vocabulary

Readiness is reported using exactly one of:

- `One-school concurrency ready`
- `Conditionally ready with listed blockers`
- `Not ready`

Readiness is claimed **only** from executed, reproducible load-test evidence
recorded in `LOAD_TEST_RESULTS.md`. Architecture review, theoretical capacity,
and code inspection are never sufficient grounds for a readiness claim.

---

## 8. Related documents

| Document | Purpose |
| --- | --- |
| `BASELINE_RESULTS.md` | Measured pre-optimization state |
| `LOAD_TEST_PLAN.md` | Scenarios, traffic mix, exact run commands |
| `LOAD_TEST_RESULTS.md` | Executed results per stage |
| `PERFORMANCE_BOTTLENECKS.md` | Findings register with evidence |
| `CONCURRENCY_CORRECTNESS.md` | Idempotency / race / transaction controls |
| `PRODUCTION_SCALING_GUIDE.md` | Deployment, pooling, worker, scaling runbook |
