# SchoolOS Deployment Runbook

**Last updated:** 2026-06-03  
**Purpose:** Consolidated staging/production deployment guide for SchoolOS  
**Replaces:**

```text
docs/production/deploy-checklist.md
docs/production/docker-vps-runbook.md
```

---

## 1. Scope

Use this runbook for every staging or production deployment.

The target pilot architecture remains:

```text
NestJS API
Next.js dashboard
PostgreSQL
Redis/BullMQ
private local or object storage
provider adapters in disabled/dev-log/configured mode
Docker VPS or equivalent managed infrastructure
```

SchoolOS remains a modular monolith for the pilot stage. Angular migration, microservices, AI/ML, biometric workflows, unapproved payment gateways, and live transport map expansion are out of scope unless explicitly approved.

---

## 2. Branch and Release Hygiene

Before deployment:

1. Confirm deployment branch and commit SHA.
2. Ensure no unrelated local changes are included.
3. Record rollback commit/image.
4. Confirm migration owner.
5. Confirm backup owner.
6. Confirm go/no-go decision owner.
7. Confirm staging URL and API URL.
8. Confirm provider modes: disabled, dev-log, mock, or configured.

Do not deploy from an unclear working tree or unknown commit.

---

## 3. Server Requirements

Recommended pilot VPS:

- 2 vCPU minimum; 4 vCPU preferred for pilot with staff training and browser QA.
- 4 GB RAM minimum; 8 GB preferred.
- 60 GB SSD minimum; 100 GB preferred if storing generated PDFs and activity images locally.
- Ubuntu 22.04 LTS or 24.04 LTS.
- Docker Engine and Docker Compose plugin.
- Node.js runtime compatible with the repo toolchain when building on server.
- `pnpm` matching the repo package manager.

Database and queue options:

- Staging default: Docker PostgreSQL and Docker Redis with persistent volumes.
- Production-ready option: managed PostgreSQL and managed Redis.
- Redis is not the durable source of truth, but persistence is recommended for BullMQ jobs and retries.

Storage:

- Local storage is acceptable for controlled pilot if backed up.
- Recommended local path:

```bash
LOCAL_STORAGE_ROOT=/var/lib/schoolos/storage
```

- Do not expose the storage directory through the reverse proxy as a public directory.
- Generated PDFs, receipts, certificates, admission uploads, activity attachments, and exports must be included in backup policy.
- R2/S3-compatible storage should only be enabled when credentials, lifecycle policy, signed URL behavior, and restore testing are ready.

---

## 4. Required Environment Variables

API environment example:

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

Web environment example:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.schoolos.example/api/v1
```

For production deploys, ensure these are set:

```bash
ALLOW_PROD_BOOT=true
DATABASE_URL
REDIS_HOST
REDIS_PORT
JWT_SECRET
JWT_CHALLENGE_SECRET
MEDICAL_ENCRYPTION_KEY
FRONTEND_ORIGIN or FRONTEND_ORIGINS
```

If using webhook email mode:

```bash
EMAIL_WEBHOOK_URL
EMAIL_WEBHOOK_TOKEN
```

If using R2/object storage:

```bash
R2_BUCKET
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_REGION=auto
R2_PUBLIC_BASE_URL
```

Cookie and CORS rules:

- Use HTTPS for staging and production.
- Use `COOKIE_SAME_SITE=lax` when web and API are same-site.
- Use `COOKIE_SAME_SITE=none` only for cross-site HTTPS deployments.
- Keep `TRUST_PROXY=true` behind Nginx, Caddy, Traefik, or a load balancer.
- `FRONTEND_ORIGIN` must match the public dashboard origin exactly.
- Browser auth is cookie-first; do not store raw access or refresh tokens in browser storage.

Provider rules:

- Keep `EMAIL_DELIVERY_MODE=log` for pilot unless webhook/email credentials are approved.
- SMS, FCM, and external email providers should stay disabled or stubbed unless explicitly configured.
- Payment gateways must stay disabled/mock until sandbox/staging verification is approved.
- Provider failures must not block admissions, attendance, fees, activity, or notices workflows unless the workflow requires that provider.

---

## 5. Canonical Verification Command

Run from repo root before deployment:

```bash
pnpm verify:deploy
```

It should cover:

- Deploy env preflight.
- Tracked artifact guard.
- Prisma generate/validate.
- OpenAPI gate.
- Lint.
- Typecheck.
- Unit tests.
- API E2E.
- Web smoke E2E.
- Build.

CI behavior:

- CI always runs `pnpm verify:deploy:core`.
- CI runs web smoke E2E only when web-impacting files changed.
- If web smoke is skipped in CI but deployment affects UI runtime behavior, run `pnpm test:web:e2e` manually before go-live.

Full verification fallback:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

If Docker/API/web are running:

```bash
pnpm smoke:phase1
SMOKE_LOGIN=true pnpm smoke:phase1
```

Do not proceed to pilot handoff if any required verification fails unless the owner explicitly waives the failure in writing.

---

## 6. Deployment Steps

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

9. Run browser smoke against staging before sharing credentials with pilot staff.

---

## 7. Reverse Proxy Notes

Use Nginx, Caddy, Traefik, or a managed load balancer.

Required behavior:

- Terminate TLS at the proxy.
- Forward `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Request-Id` when available.
- Do not expose PostgreSQL, Redis, or storage directories publicly.
- Route the API origin to the NestJS service on port `4000`.
- Route the web origin to the Next.js service on port `3000`.
- Keep upload/body limits aligned with media and document rules.

---

## 8. Health Checks

Required checks:

- API liveness: `GET /api/v1/health`.
- API readiness: `GET /api/v1/ready`.
- Local smoke: `pnpm smoke:phase1`.
- Seeded login smoke: `SMOKE_LOGIN=true pnpm smoke:phase1`.

Readiness must verify PostgreSQL and Redis before traffic is allowed. If `/ready` fails, do not proceed with pilot browser QA.

---

## 9. Database, Migration, and Rollback

Before migration:

1. Take a database backup.
2. Take a storage backup if file schemas/routes changed.
3. Record release commit SHA.
4. Confirm rollback owner and command.

Backup before deploy:

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
6. Run `/health`, `/ready`, and browser smoke before reopening access.

Never hard-delete financial, attendance, student, certificate, or audit records during rollback. Prefer corrective records or restoring a snapshot after freezing traffic.

---

## 10. Logs and Monitoring

Minimum log sources:

- API process logs.
- Web process logs.
- `docker compose logs postgres redis`.
- Notification processor logs.
- Reverse proxy access and error logs.
- Database migration logs.

Operational checks:

- Failed notification deliveries in Communications screen.
- API request IDs for bug reports.
- Readiness failures.
- Redis connection failures and BullMQ retry errors.
- Prisma/database errors.
- Storage write failures for PDFs and activity attachments.
- Payment callback/verification failures when gateways are enabled.

For pilot, review logs daily and after every staff training session.

---

## 11. Backup Policy Summary

Minimum staging backup policy before pilot:

- PostgreSQL full backup daily.
- Storage artifact backup daily.
- Environment/proxy/deploy config backup on every deployment.
- Redis persistence enabled if scheduled delivery jobs are active.
- Monthly restore drill once pilot is live.

Retention recommendation:

- Keep daily backups for 14 days.
- Keep weekly backups for 8 weeks.
- Keep release-day backups indefinitely during pilot.
- Keep generated certificates, receipts, audit records, and ledger data according to statutory/school policy.

For detailed restore procedure, use:

```text
docs/production/backup-restore-runbook.md
```

---

## 12. Go/No-Go Checklist

Go only if all items are true:

- Deployment branch and commit SHA are finalized.
- Backup and rollback path verified.
- Required environment values are configured.
- Provider modes are explicitly known.
- `pnpm verify:deploy` passed or equivalent full verification passed.
- Migration and readiness checks passed.
- `/health` and `/ready` pass.
- Browser smoke passed for pilot modules.
- No critical unresolved incidents.
- Owner has accepted any documented waivers.

No-go if:

- Tenant isolation is failing.
- Payment/receipt/accounting flow is inconsistent.
- Parent can view non-linked child data.
- File access exposes raw/private storage paths.
- Suspended tenant can still use dashboard/API/mobile/jobs/downloads.
- Backup/rollback path is unknown.
