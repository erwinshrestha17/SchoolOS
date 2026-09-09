# Full Active-P0 Smoke Evidence (Local Staging)

- Date: 2026-09-09
- API base URL: `http://localhost:4000/api/v1`
- Result: **PASS**

## Preparation

The local-staging database was migrated and seeded by `pnpm staging:deploy:local`. The dedicated production-guarded M0 Platform E2E fixture was then seeded for the separate Platform security domain.

## Command

```bash
pnpm smoke:full
```

## Verified scope

- PostgreSQL, Redis, API liveness, and API readiness
- School and Platform authentication remain separate
- Platform health, tenant, queue, and provider-readiness endpoints
- School administrators and principals are denied Platform health
- Admin, principal, parent, class-teacher, subject-teacher, staff, accountant, and driver role paths
- Linked-child, assigned-class, assigned-subject, self-service, finance-total, transport-manifest, and logout-revocation boundaries
- M13 Learning is excluded from this mandatory active-P0 smoke and remains frozen and disabled by default; its explicit compatibility smoke remains separate

## Evidence boundary

This is local HTTP staging-simulation evidence with deterministic fixtures. It is not TLS staging, external-provider, physical-device, controlled-pilot, release-candidate, or GA evidence.
