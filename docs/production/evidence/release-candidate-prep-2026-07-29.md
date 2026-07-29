# Release Candidate Preparation Evidence

- Date: 2026-07-29
- Status: **PREPARED** (artifacts in repo; sign-off pending)

## Deliverables added

| Artifact | Path |
| --- | --- |
| Release rollback procedure | [RELEASE_ROLLBACK_PROCEDURE.md](../RELEASE_ROLLBACK_PROCEDURE.md) |
| P1 security triage | [P1_SECURITY_TRIAGE.md](../P1_SECURITY_TRIAGE.md) |
| GA sign-off checklist | [RELEASE_SIGNOFF_CHECKLIST.md](../RELEASE_SIGNOFF_CHECKLIST.md) |
| Ops hardening: `/ready` 503 when degraded | `apps/api/src/app.controller.ts` + `readiness.spec.ts` |
| Ops hardening: migrate-before-start entrypoint | `apps/api/docker-entrypoint.sh` |
| Ops hardening: Docker deploy artifacts | `docker-compose.staging.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile` |
| Monitoring helper | `pnpm staging:health` (`scripts/check-staging-health.mjs`) |

## Rollback rehearsal

- Database restore rehearsal: local PASS (2026-07-29)
- Application rollback rehearsal: document on next staging deploy (redeploy previous image SHA)

## Release owner sign-off

Use [RELEASE_SIGNOFF_CHECKLIST.md](../RELEASE_SIGNOFF_CHECKLIST.md). **Not signed** in this wave.

## Open GA blockers (from P1 triage)

- Staging TLS validation + full smoke/E2E
- Monitoring/alerting on production host
- Controlled pilot completion
- Mobile device/emulator QA
- Close P1-01, P1-04, P1-07, P1-09 before GA sign-off
