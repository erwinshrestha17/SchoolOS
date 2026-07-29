# GA Release Sign-Off Checklist

Complete before claiming GA / production release per [SCHOOLOS_GA_RELEASE_POLICY.md](./SCHOOLOS_GA_RELEASE_POLICY.md).

## Security and correctness (P0)

- [ ] DEF-01–DEF-06 verified on staging with recorded evidence
- [ ] Tenant isolation spot checks passed
- [ ] Teacher/parent/guardian scope denial tests passed
- [ ] Disabled modules and suspended tenant fail-closed verified
- [ ] Sensitive writes audited on pilot workflows

## Staging and deployment

- [ ] Staging migrations applied successfully
- [ ] `pnpm verify:env:staging` passed on staging host
- [ ] `pnpm smoke:pilot` passed against staging
- [ ] Authenticated browser E2E passed against seeded staging
- [ ] Docker/API/web deploy artifacts documented

## Operations

- [ ] Backup created on schedule; restore drill recorded (staging + production path)
- [ ] Release rollback procedure rehearsed
- [ ] `/ready` returns 503 when dependencies unavailable
- [ ] Monitoring/alerting configured for `/health`, `/ready`, queue depth, error rate
- [ ] Incident and on-call runbook acknowledged by operator

## Mobile and pilot

- [ ] Flutter analyze + test passed; device/emulator QA recorded for parent/teacher/principal
- [ ] Controlled pilot checklist completed for one school
- [ ] Pilot feedback triaged; no open P0 incidents

## Documentation

- [ ] Pilot boundary documented and matches entitlements
- [ ] Training/onboarding docs match enabled modules (C1 resolved)
- [ ] P1 security triage GA blockers closed or deferred with owner approval

## Approvals

| Role | Name | Date | Signature / link |
| --- | --- | --- | --- |
| Release owner | | | |
| Product owner | | | |
| Engineering lead | | | |

**Outcome:** `GO` / `NO-GO`

**Notes:**
