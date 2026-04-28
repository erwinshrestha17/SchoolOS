# SchoolOS Docker VPS Runbook

This runbook captures the minimum production controls expected before running SchoolOS on a Docker VPS. The current target is Web + API with Postgres, Redis, local/log provider adapters, and manual/cash/bank fee workflows. AI and payment gateways are intentionally last.

## Required Production Environment

Set these variables for the API container:

- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL=postgresql://...`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `JWT_SECRET` with at least 32 random characters
- `JWT_CHALLENGE_SECRET` with at least 32 random characters
- `MEDICAL_ENCRYPTION_KEY` with at least 32 random characters
- `FRONTEND_ORIGIN=https://your-schoolos-domain`
- `TRUST_PROXY=true` when behind Nginx, Caddy, Traefik, or a load balancer
- `COOKIE_SAME_SITE=lax` for same-site deployments, or `none` only when cross-site HTTPS cookies are required
- `LOCAL_STORAGE_ROOT=/var/lib/schoolos/storage` for local storage mode

Provider-specific variables are required only when enabled:

- `EMAIL_DELIVERY_MODE=webhook` requires `EMAIL_WEBHOOK_URL` and `EMAIL_WEBHOOK_TOKEN`.
- `STORAGE_PROVIDER=r2` requires `R2_PUBLIC_BASE_URL` and the selected R2 adapter credentials once real R2 is enabled.

The API now fails fast during startup if required production secrets or provider settings are missing.

## Runtime Checks

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/ready`
- API docs: `GET /api/v1/docs`

The readiness endpoint checks both Postgres and Redis. Keep it wired into container health checks or reverse-proxy upstream checks before exposing traffic.

For the local Docker pilot baseline, `pnpm smoke:phase1` validates Postgres,
Redis, and API readiness. Use `SMOKE_LOGIN=true pnpm smoke:phase1` after seeding
to include the default admin login in the smoke pass.

## Deployment Order

1. Build images from a clean commit.
2. Start Postgres and Redis with persistent volumes.
3. Run Prisma migrations against production Postgres.
4. Run the seed only when intentionally provisioning baseline roles/admins.
5. Start API, then wait for `/api/v1/ready`.
6. Start Web and verify it targets the API origin.
7. Run a smoke path: login, tenant/session check, create academic structure, admission, invoice/payment, ledger, notice delivery.

## Reverse Proxy Notes

- Terminate TLS at the proxy.
- Forward `X-Request-Id` when present; otherwise the API generates one.
- Preserve `X-Forwarded-Proto` and `X-Forwarded-For` and set `TRUST_PROXY=true`.
- Do not expose Postgres, Redis, or local storage paths publicly.

## Production Gates

Before a production deploy, run:

```bash
pnpm db:generate
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/api test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Add release-blocking CI checks for Prisma migration drift, OpenAPI contract drift, permission catalog drift, and backend e2e workflows before the first live school rollout.
