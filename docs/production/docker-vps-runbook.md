# SchoolOS Phase 1 Staging Deployment Runbook

This runbook prepares the current SchoolOS Phase 1 Web + API stack for a controlled pilot-school staging deployment. The target architecture remains a Docker VPS running the NestJS API, Next.js dashboard, PostgreSQL, Redis, local/log provider adapters, and local storage unless object storage is explicitly configured.

Phase 2 modules, Angular dashboard migration, AI features, and payment gateways are out of scope for this staging runbook.

## 1. Server Requirements

Recommended pilot VPS:

- 2 vCPU minimum, 4 vCPU preferred for pilot with staff training and browser QA.
- 4 GB RAM minimum, 8 GB preferred.
- 60 GB SSD minimum, 100 GB preferred if storing generated PDFs and activity images locally.
- Ubuntu 22.04 LTS or 24.04 LTS.
- Docker Engine and Docker Compose plugin.
- Node.js runtime compatible with the repo toolchain when building on the server.
- `pnpm` matching the repo package manager, currently `pnpm@10.12.1`.

Database and queue options:

- Staging default: Docker PostgreSQL and Docker Redis with persistent volumes.
- Production-ready option: managed PostgreSQL and managed Redis, with the same `DATABASE_URL`, `REDIS_HOST`, and `REDIS_PORT` contract.
- Redis should not be treated as the source of truth, but persistence is recommended because BullMQ notification jobs and retries depend on it.

Storage:

- Local storage is acceptable for the controlled pilot when backed up: set `LOCAL_STORAGE_ROOT=/var/lib/schoolos/storage`.
- Do not expose the storage directory through the reverse proxy as a public directory.
- Generated PDFs, receipts, certificates, admission uploads, and activity attachments must be included in backup policy.
- R2/object storage remains adapter-ready, but do not enable it unless credentials, lifecycle policy, and restore testing are ready.

## 2. Required Environment Variables

API environment:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://schoolos:strong-password@postgres:5432/schoolos_db?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=replace-with-32-plus-character-random-secret
JWT_CHALLENGE_SECRET=replace-with-second-32-plus-character-random-secret
JWT_ACCESS_TTL=15m
JWT_CHALLENGE_TTL=10m
JWT_REFRESH_TTL_DAYS=7
BCRYPT_ROUNDS=12
MEDICAL_ENCRYPTION_KEY=replace-with-32-plus-character-random-secret
FRONTEND_ORIGIN=https://staging.schoolos.example
PASSWORD_RESET_APP_URL=https://staging.schoolos.example/reset-password
TRUST_PROXY=true
ACCESS_COOKIE_NAME=school_os_access_token
REFRESH_COOKIE_NAME=school_os_refresh_token
COOKIE_DOMAIN=
COOKIE_SAME_SITE=lax
EMAIL_DELIVERY_MODE=log
EMAIL_FROM_ADDRESS=no-reply@schoolos.local
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=/var/lib/schoolos/storage
LOCAL_STORAGE_PUBLIC_BASE_URL=/storage
```

Web environment:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.schoolos.example/api/v1
```

Cookie and CORS rules:

- Use HTTPS for staging and production.
- Use `COOKIE_SAME_SITE=lax` when web and API are same-site.
- Use `COOKIE_SAME_SITE=none` only for cross-site HTTPS deployments.
- Keep `TRUST_PROXY=true` behind Nginx, Caddy, Traefik, or a load balancer.
- `FRONTEND_ORIGIN` must match the public dashboard origin exactly.
- Browser auth is cookie-first; do not store raw access or refresh tokens in browser storage.

Provider stubs:

- Keep `EMAIL_DELIVERY_MODE=log` for pilot unless webhook/email credentials are approved.
- SMS, FCM, and external email providers should stay disabled or stubbed unless explicitly configured.
- Provider failures must not block admissions, attendance, fees, activity, or notices workflows.

## 3. Deployment Steps

1. Clone and inspect the release commit:

```bash
git clone <repo-url> SchoolOS
cd SchoolOS
git checkout <release-commit-or-tag>
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure environment files:

```bash
cp apps/api/.env.example apps/api/.env
```

Update `apps/api/.env` for staging secrets, database, Redis, cookies, storage, and provider mode. Configure the web environment so `NEXT_PUBLIC_API_BASE_URL` points to the public API origin.

4. Start infrastructure:

```bash
docker compose up -d postgres redis
docker compose ps
```

5. Prepare the database:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
```

Run seed only when intentionally provisioning baseline data:

```bash
pnpm db:seed
```

6. Build applications:

```bash
pnpm build
```

7. Start API and web using the selected process manager or container entrypoints.

8. Verify runtime health:

```bash
curl -fsS https://api-staging.schoolos.example/api/v1/health
curl -fsS https://api-staging.schoolos.example/api/v1/ready
pnpm smoke:phase1
```

9. Run browser smoke against the staging URL before sharing credentials with pilot staff.

## 4. Reverse Proxy Notes

Use Nginx, Caddy, Traefik, or a managed load balancer:

- Terminate TLS at the proxy.
- Forward `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Request-Id` when available.
- Do not expose PostgreSQL, Redis, or storage directories publicly.
- Route the API origin to the NestJS service on port `4000`.
- Route the web origin to the Next.js service on port `3000`.
- Keep upload/body limits aligned with the Phase 1 media rules, especially activity images.

## 5. Health Checks

Required checks:

- API liveness: `GET /api/v1/health`
- API readiness: `GET /api/v1/ready`
- Local smoke: `pnpm smoke:phase1`
- Seeded login smoke after provisioning: `SMOKE_LOGIN=true pnpm smoke:phase1`

Readiness must verify PostgreSQL and Redis before traffic is allowed. If `/ready` fails, do not proceed with pilot browser QA.

## 6. Rollback Procedure

Before deploy:

```bash
pg_dump --format=custom --file=/backups/schoolos-before-$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
tar -czf /backups/schoolos-storage-before-$(date +%Y%m%d%H%M).tgz /var/lib/schoolos/storage
git rev-parse HEAD > /backups/schoolos-release-sha.txt
```

Rollback options:

1. Stop API and web traffic.
2. Redeploy the previous known-good image or commit.
3. Run `pnpm db:generate` after checkout if dependencies changed.
4. Restore database only if the failed release wrote incompatible or corrupt data.
5. Restore storage only if uploaded/generated artifacts were corrupted or deleted.
6. Run `/health`, `/ready`, and the browser smoke checklist before reopening access.

Never hard-delete financial, attendance, student, certificate, or audit records during rollback. Prefer corrective records or restoring a snapshot after freezing traffic.

## 7. Logs And Monitoring

Minimum log sources:

- API process logs.
- Web process logs.
- `docker compose logs postgres redis`.
- Notification processor logs.
- Reverse proxy access and error logs.
- Database migration logs.

Operational checks:

- Failed notification deliveries in the Communications screen.
- API request IDs for bug reports.
- Readiness failures.
- Redis connection failures and BullMQ retry errors.
- Prisma/database errors.
- Storage write failures for PDFs and activity attachments.

For pilot, review logs daily and after every staff training session.

## 8. Backup Policy

Minimum staging backup policy before pilot:

- PostgreSQL full backup daily.
- Storage artifact backup daily.
- Environment/proxy/deploy config backup on every deployment.
- Redis persistence enabled if scheduled delivery jobs are active.
- Monthly restore drill once the pilot is live.

Retention recommendation:

- Keep daily backups for 14 days.
- Keep weekly backups for 8 weeks.
- Keep release-day backups indefinitely during pilot.
- Keep generated certificates, receipts, audit records, and ledger data according to statutory/school policy.

## 9. Production Verification Gate

Run before every pilot release:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

If Docker/API is running:

```bash
pnpm smoke:phase1
SMOKE_LOGIN=true pnpm smoke:phase1
```

Do not proceed to pilot handoff if any required verification fails.
