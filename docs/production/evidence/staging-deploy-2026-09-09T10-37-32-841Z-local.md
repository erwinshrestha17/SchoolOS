# Staging Deploy Evidence (Local Simulation)

- Date: 2026-09-09T10:37:32.841Z
- Environment: local-staging (docker-compose.staging.yml postgres/redis on ports 5434/6380)
- Result: **PASS**

## Infrastructure

- Postgres: `schoolos_staging` on localhost:5434
- Redis: localhost:6380
- API env file generated: `apps/api/.env.staging-local` (gitignored pattern — do not commit secrets)

## Commands executed

```bash
docker compose -f docker-compose.staging.yml -p schoolos-staging up -d postgres redis
pnpm db:generate
pnpm --filter @schoolos/api exec prisma migrate deploy
pnpm db:seed
SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES=true pnpm db:seed:e2e:m0-platform
pnpm --filter @schoolos/api db:backfill:teacher-assignments
pnpm --filter @schoolos/api db:backfill:guardian-capabilities
```

## Notes

- M13 Learning remains disabled by the canonical seed for pilot tenants; this staging helper does not override frozen module entitlements.
- The dedicated Platform fixture is local-E2E-only and is rejected when `NODE_ENV=production`; real staging must use explicitly bootstrapped operator credentials.
- Full TLS staging preflight (`pnpm verify:env:staging`) requires HTTPS origins on the target host.
- Containerized API/web deploy: `docker compose -f docker-compose.staging.yml --profile app up -d --build`
- Optional controlled-pilot rehearsal tenant: `pnpm provision:pilot-rehearsal` (separate from `default-school` smoke tenant)
- Rehearsal started: 2026-09-09T10:37:11.878Z
- Rehearsal finished: 2026-09-09T10:37:32.841Z
