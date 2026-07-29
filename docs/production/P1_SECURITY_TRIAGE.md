# P1 Security and Operability Triage

Items below are **not** open P0 defects after DEF-01–DEF-06 remediation, but remain GA risks. Track in GitHub Issues; fix before GA if they affect the supported pilot boundary.

| ID | Area | Risk | Recommended action | GA blocker? |
| --- | --- | --- | --- | --- |
| P1-01 | Auth | `mustChangePassword` not enforced server-side | Enforce on sensitive routes after temp credential issue | Yes for pilot admin onboarding |
| P1-02 | Tenancy | Prisma auto-scope excludes upsert/aggregate/raw; jobs without CLS | Audit hot paths; set CLS in processors | Yes if unscoped writes found |
| P1-03 | Auth | Support override breaks `/auth/me` | Fix override + add regression test | Medium |
| P1-04 | Guardians | Post-revoke guardian residual notification inbox access | Fail-closed inbox filter | Yes for parent trust |
| P1-05 | Guardians | No DB constraint for single primary guardian | Migration + validation | Medium |
| P1-06 | Ops | `/ready` returned 200 when degraded | **Remediated**: 503 when degraded | Closed |
| P1-07 | Ops | No monitoring/alerts | Add health polling + alert webhook | Yes for production |
| P1-08 | Ops | Redis auth/TLS unsupported | Document VPS network isolation or add auth | Staging dependent |
| P1-09 | Mobile | Cold start expired access token logs out instead of refresh | Fix token refresh path | Yes for parent daily use |
| P1-10 | Mobile | Homework create not idempotent | Add idempotency key | Medium |
| P1-11 | Web | Notice approvals page read-only | Add write UI or defer approvals from pilot | Pilot dependent |
| P1-12 | Web | Homework date filter client-capped at 100 | Server pagination | Medium |
| P1-13 | Entitlements | `service-requests` + `advanced-operations` controllers ungated | Assign module keys + gate | Medium (out of pilot nav) |
| P1-14 | Academics | CAS web pickers tenant-wide vs backend scope | Scope pickers with teacher assignment helper | Medium (exams disabled) |

## Triage rules

1. **Fix before controlled pilot** if the issue affects tenant isolation, persona scope, attendance, guardian access, or provisioning.
2. **Fix before GA** if the issue affects daily operations, recovery, monitoring, or parent/teacher mobile reliability.
3. **Defer post-GA** if module is disabled for pilot and fail-closed holds.

## Sign-off

Release owner reviews this table at release candidate and confirms each GA-blocker row is closed or explicitly deferred with expiry.
