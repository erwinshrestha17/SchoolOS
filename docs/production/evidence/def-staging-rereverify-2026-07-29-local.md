# DEF Staging Re-Verification Evidence (Local Simulation)

- Date: 2026-07-29
- Environment: local-staging API against `schoolos_staging` database
- Result: **PASS** (automated subset)

## Checks executed

| DEF | Check | Result |
| --- | --- | --- |
| DEF-01 | Unauthenticated `POST /tenants/register` denied | PASS (403) |
| DEF-02 | Homeroom attendance write scoping | Manual staging QA pending |
| DEF-03 | Marks/CAS authz | Module disabled; code unit-tested locally |
| DEF-04 | Class-teacher assignment API | Manual UI staging QA pending |
| DEF-05 | Backup/restore on staging DB | PASS (see staging-backup evidence) |
| DEF-06 | Teacher-workspace entitlement + assignments | PASS (200 with teacher token) |

## Automated command

```bash
SMOKE_API_BASE_URL=http://localhost:4000/api/v1 node scripts/verify-def-staging.mjs
```

## Manual staging follow-up

- DEF-02: subject teacher denied on attendance write; homeroom allowed
- DEF-04: assign class teacher via settings UI on staging
- DEF-06: disabled module returns 403 on gated controllers
