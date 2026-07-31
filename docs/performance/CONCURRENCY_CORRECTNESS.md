# SchoolOS — Concurrency Correctness

Concurrency improvements must never buy throughput with data corruption. This
document records which correctness controls exist, which are **verified by
execution**, and which are **inspected only**.

Status key:

| Marker | Meaning |
| --- | --- |
| `VERIFIED` | exercised under concurrent execution, result recorded |
| `INSPECTED` | schema/code reviewed; not yet run concurrently |
| `GAP` | no control found, or control found insufficient |

---

## 1. Attendance

### Business-key uniqueness — `INSPECTED` (schema is strong)

`apps/api/prisma/schema.prisma`:

```prisma
model AttendanceSession {
  @@unique([tenantId, attendanceDate, classId, sectionId])
  @@unique([tenantId, sourceClientSubmissionId],
           map: "attendance_session_source_submission_key")
}

model AttendanceRecord {
  @@unique([attendanceSessionId, studentId])
}
```

Both boundaries required by the program brief are enforced **at the database**,
not only in application logic:

- one session per tenant/date/class/section — duplicate sessions are impossible
- one record per session/student — duplicate per-student marks are impossible
- one session per client submission id — retries cannot fan out

This is the strongest correctness position in the codebase and needed no
change.

### Offline retry / duplicate submit — `VERIFIED`

Five concurrent `POST mobile/teacher/attendance/sync` calls carrying an
identical `clientSubmissionId`:

| Response | Outcome |
| --- | --- |
| 1 | session resolved, `replayed=false` |
| 2–5 | `replayed=true` |

`SELECT count(*) FROM "AttendanceSession" WHERE "sourceClientSubmissionId" = …`
returned **no duplicate sessions**.

Conclusion: the double-submit, offline-retry, and timeout-after-commit cases
are handled. The k6 teacher workflow issues the retry on every iteration, so
Scenario B re-verifies this continuously at load.

### Attendance lifecycle — `INSPECTED`

`AttendanceSession` carries `submittedAt`, `lockAt`, and
`conflictStatus (AttendanceConflictStatus)`, plus an `AttendanceConflict`
relation and `AttendanceCorrectionRequest`. A draft model exists
(`AttendanceDraft`). The brief's `DRAFT → SUBMITTED → LOCKED → CORRECTED`
lifecycle is therefore substantially present.

Not yet verified: two-device concurrent submission for the same section,
teacher-and-admin simultaneous edit, and stale-draft overwrite. These need
targeted concurrent tests.

---

## 2. Request accounting — fixed

**Was:** every API request performed
`UPSERT UsageCounter … value = value + 1` against a single row per tenant per
month. Every request in a single-tenant deployment therefore contended for one
row-level exclusive lock — a global serialization point, and write
amplification on a read-dominated workload.

**Now:** deltas accumulate in a Redis hash via `HINCRBY` and flush to
PostgreSQL once a minute.

Correctness properties of the new path:

| Property | How it is held |
| --- | --- |
| No double counting across replicas | flush uses `MULTI` + `HGETALL` + `DEL`; the losing replica sees an empty hash |
| No lost counts on database failure | failed batch is returned to Redis with `HINCRBY` |
| No lost counts on Redis failure | `incrementUsage` falls back to the direct database write |
| Reads stay accurate between flushes | `getCurrentUsageCount` adds the un-flushed Redis delta |
| Deltas arriving mid-flush are kept | `HINCRBY` recreates the hash after `DEL`; next flush collects them |

Files: `apps/api/src/usage/usage.service.ts`, `usage.module.ts`.

---

## 3. Entitlement / tenant-status caching — safe by construction

The request-scoped cache (`src/common/cache/request-cache.service.ts`) is keyed
inside the CLS context and lives for exactly one request.

| Risk | Why it does not apply |
| --- | --- |
| Suspended tenant keeps working | cache dies with the request; next request re-reads `isActive` |
| Revoked entitlement still honoured | same |
| Stale permissions across replicas | nothing is shared between requests or processes |
| Poisoned cache after a transient error | rejected loaders are evicted, next call retries |
| Background jobs seeing stale state | no CLS context outside a request ⇒ no memoization at all |

Covered by `request-cache.service.spec.ts` (7 tests), including the
outside-a-request pass-through and rejected-loader eviction cases.

> A **cross-request** Redis cache for entitlements would be a materially
> different risk and is deliberately *not* implemented yet. It requires an
> explicit invalidation contract at all twelve tenant-config write sites (§7)
> before "suspended tenants fail closed" can still be guaranteed.

---

## 4. Marks — `GAP` (not assessed)

Not examined under concurrency. Outstanding questions: simultaneous edits by
two teachers, stale draft overwrite, duplicate mark entries, submission after
lock, and class-teacher vs subject-teacher authorization collision.

`MarkEntry` exists in the schema; its uniqueness constraints were not audited.

---

## 5. Payments — `GAP` (not assessed)

Not examined. Outstanding: duplicate provider callbacks, repeated receipt
generation, retry after timeout, reversal races, duplicate accounting posting.

`apps/api/AGENTS.md` states money writes must be idempotent and audited, and
prior work in M3/M11 built idempotency mechanisms — but none of it was
re-verified under concurrent execution in this pass. **Do not treat this as
passing.**

---

## 6. Notifications — `GAP` (partially inspected)

`NotificationDelivery` carries `@@unique([tenantId, idempotencyKey])`, which is
the right primitive for suppressing duplicate delivery, and the seed generator
relies on it. Whether every producer sets a stable idempotency key — and
whether fan-out is transactional with the triggering write — was not verified.

---

## 7. Tenant-config write sites requiring invalidation

Needed before any cross-request entitlement cache is introduced. Identified by
grep; each writes tenant status, subscription, or feature overrides:

```text
src/platform/platform.service.ts:617, 991-1036 (setFeatureOverride),
                                 1673, 1724, 1729, 1775, 1780
src/platform/platform-billing-lifecycle.service.ts:60, 95, 127, 132, 207
src/users/users.service.ts:320
```

---

## 8. Controls verified this pass

| Control | Status |
| --- | --- |
| Duplicate attendance sessions under concurrent identical submits | `VERIFIED` — zero |
| Attendance business-key uniqueness at the database | `INSPECTED` — strong |
| Usage counter accuracy across flush/failure paths | `INSPECTED` + unit-tested |
| Request cache cannot leak state across requests | `VERIFIED` by unit tests |
| Lost confirmed writes during load runs | zero errors observed; not stress-verified |
| Cross-tenant exposure | not tested — query in `LOAD_TEST_PLAN.md` §6 |

---

## 9. Required before a readiness claim

1. Concurrent two-device attendance submission for the same section.
2. Marks concurrency: simultaneous edit, post-lock submission, stale draft.
3. Payment callback deduplication under concurrent duplicate callbacks.
4. Notification fan-out duplicate suppression at load.
5. Cross-tenant leakage query after every write-heavy run.
6. Deadlock and pool-exhaustion counters during Scenarios B, D, E.
