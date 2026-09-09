# P1-10 Homework Create Idempotency Evidence (Local)

- Date: 2026-09-09
- Environment: local API, PostgreSQL, authenticated Redis, web/mobile source
- Result: **PASS for local contract and runtime replay**

## Implemented boundary

- Web and Flutter teacher homework creation retain one `clientOperationId` across retry/offline replay.
- PostgreSQL has a tenant-scoped unique constraint on `(tenantId, clientOperationId)`.
- The service stores an immutable request fingerprint with the draft.
- An identical replay returns the existing draft without editing it.
- A different payload using the same operation ID fails with HTTP 409.
- Concurrent duplicate creates recover from the database unique fence and return the same authoritative draft.

## Verification

| Gate | Result |
| --- | --- |
| Focused homework service suites | PASS — 2 suites, 36 tests |
| Full API unit suite | PASS — 271 suites, 2,983 tests |
| API typecheck | PASS |
| API production build | PASS |
| Flutter analyze | PASS — no issues |
| Flutter teacher homework repository test | PASS — 3 tests |
| Live concurrent API create | PASS — two HTTP 201 responses, same resource ID |
| Live mismatched replay | PASS — HTTP 409 |

Expected negative-path logs from API tests are not runtime failures.

## Evidence boundary

This proves local server/database behavior and Flutter repository wiring. It does not prove physical-device reconnect behavior, process failover, multi-instance latency, or TLS staging. Repeat the queued-draft reconnect and concurrent retry scenario on a physical teacher device against the controlled-pilot staging deployment before release approval.
