# Readiness Dependency-Failure Rehearsal (2026-09-09, local)

- Started: 2026-09-09T09:50:41.325Z
- Finished: 2026-09-09T09:50:41.807Z
- API: http://localhost:4000/api/v1
- Dependency interrupted: Redis container `schoolos_staging_redis`
- Result: **PASS**

| Phase | Expected HTTP | Observed HTTP | Reported status |
| --- | ---: | ---: | --- |
| Initial readiness | 200 | 200 | ready |
| Redis unavailable | 503 | 503 | degraded |
| Redis restored | 200 | 200 | ready |

## Evidence boundary

This proves local fail-closed readiness behavior and recovery only. Repeat through the production monitoring path on TLS staging before release approval.
