# Staging Deploy Evidence (Local Simulation)

- Date: 2026-07-29T12:32:28.484Z
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
```

## Notes

- Full TLS staging preflight (`pnpm verify:env:staging`) requires HTTPS origins on the target host.
- Containerized API/web deploy: `docker compose -f docker-compose.staging.yml --profile app up -d --build`
- Rehearsal started: 2026-07-29T12:32:06.946Z
- Rehearsal finished: 2026-07-29T12:32:28.484Z
