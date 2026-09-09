# P1-08 Redis Transport Security Evidence (Local)

- Date: 2026-09-09
- Environment: local workstation and `docker-compose.staging.yml`
- Result: **PASS for local implementation and authenticated-connectivity rehearsal**

## Implemented boundary

- `ConfigService.redisConnectionOptions` is the single connection contract used by the direct `RedisService` client and BullMQ.
- Optional Redis ACL username/password and certificate-verified TLS are supported.
- Production runtime validation requires `REDIS_PASSWORD` and `REDIS_TLS_ENABLED=true` unless `REDIS_ALLOW_PLAINTEXT=true` explicitly records a verified private-network deployment.
- The staging/deployment preflight enforces the same password and transport choice.
- Local compose Redis requires authentication. PostgreSQL and Redis host ports are loopback-bound.
- The smoke runner uses the same username/password/TLS environment contract as the API.

## Verification

| Gate | Result |
| --- | --- |
| Focused configuration and Redis unit tests | PASS — 3 suites, 42 tests |
| Focused lint for touched API files | PASS — 0 errors, 0 warnings |
| API typecheck | PASS |
| API production build | PASS |
| Full API unit suite | PASS — 271 suites, 2,981 tests |
| Compose configuration validation | PASS |
| Unauthenticated local Redis PING | PASS — rejected with `NOAUTH Authentication required` |
| Authenticated local Redis PING | PASS — `PONG` |
| API `/ready` with authenticated Redis | PASS — HTTP 200, Redis `ok` |
| Full active-P0/platform smoke | PASS, including Redis connectivity and Platform Queues |
| Staging deploy environment preflight with TLS configuration | PASS |

Expected negative-path logs from unit tests are not runtime failures. One incorrectly forwarded Jest invocation found no tests; the corrected canonical command produced the full 2,981-test pass above.

## Evidence boundary

This is local proof. The compose rehearsal uses password-authenticated plaintext Redis inside a loopback/private-network topology and exercises the explicit exception. It does not prove certificate negotiation, managed Redis ACLs, VPS firewall rules, secret injection, failover, or production queue durability. Before release approval, repeat readiness, queue processing, failure recovery, and smoke checks against certificate-verified TLS Redis on the real staging host.
