# SchoolOS Production Runbook

**Last updated:** 2026-07-12
**Status:** Consolidated active production runbook, deployment manual, database backup/restore procedures, and pilot onboarding guidelines.  
**Architecture:** NestJS modular monolith, PostgreSQL, Redis/BullMQ, private storage.

This runbook defines deployment, recovery, and controlled-pilot operating procedures. It is not proof that any procedure has been executed or that SchoolOS has passed a release gate. The current posture is **Internal QA / controlled-pilot preparation**. Current work and blockers belong in GitHub Issues, Milestones, or Projects; current evidence belongs in CI runs, smoke outputs, staging records, and release artifacts.

The active education scope is Preschool, School (Grade 1-10), and Higher Secondary (Grade 11-12 / +2) over one tenant-aware core. A broad Student App and M14 Intelligence / AI runtime are not active scope.

---

## 1. Deployment and Server Setup

### Scope
Use this runbook for every staging or production deployment.
The target pilot architecture is: NestJS API, Next.js dashboard, PostgreSQL, Redis/BullMQ, private local or object storage, and provider adapters in disabled/dev-log/configured mode.
SchoolOS remains a modular monolith. Angular migration, microservices, AI/ML runtime, biometric workflows, broad Student App access, and unverified live transport map expansion are out of scope unless explicitly approved.

### Server Requirements
Recommended pilot VPS specs:
- **CPU:** 2 vCPU minimum; 4 vCPU preferred.
- **RAM:** 4 GB RAM minimum; 8 GB preferred.
- **Disk:** 60 GB SSD minimum; 100 GB preferred if storing generated PDFs and activity images locally.
- **OS:** Ubuntu 22.04 LTS or 24.04 LTS.
- Docker Engine and Docker Compose plugin.
- Node.js runtime and `pnpm` matching the repo package manager.

Database and queue:
- **Staging default:** Docker PostgreSQL and Docker Redis with persistent volumes.
- **Production target:** Managed PostgreSQL and managed Redis, with persistence appropriate for BullMQ jobs and retries.

Storage:
- Local storage is acceptable for controlled pilot if backed up. Recommended path: `/var/lib/schoolos/storage`.
- Do not expose the storage directory through the reverse proxy as a public directory.
- R2/S3-compatible storage should only be enabled when credentials, lifecycle policy, signed URL behavior, and restore testing are ready.

### Reverse Proxy Configuration
Use Nginx, Caddy, Traefik, or a managed load balancer.
Required behavior:
- Terminate TLS at the proxy.
- Forward `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Request-Id` headers.
- Do not expose PostgreSQL, Redis, or storage directories publicly.
- Route the API origin (e.g., `api-staging.schoolos.example`) to port `4000`.
- Route the web origin (e.g., `staging.schoolos.example`) to port `3000`.
- Keep upload/body limits aligned with media and document rules.

---

## 2. Environment Variables & Security Mechanisms

### Environment Setup Examples
API environment (`apps/api/.env`):
```bash
NODE_ENV=production
DEPLOY_ENV=staging
ALLOW_PROD_BOOT=true
PORT=4000
DATABASE_URL=postgresql://schoolos:strong-password@postgres:5432/schoolos_db?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=replace-with-32-plus-character-random-secret
JWT_CHALLENGE_SECRET=replace-with-second-32-plus-character-random-secret
TOKEN_HASH_PEPPER=replace-with-third-32-plus-character-random-secret
JWT_ISSUER=schoolos-staging
JWT_AUDIENCE_WEB=schoolos-web-staging
JWT_AUDIENCE_MOBILE=schoolos-mobile-staging
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
LOCAL_STORAGE_PUBLIC_BASE_URL=/protected-storage
```

Web environment (`apps/web/.env`):
```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.schoolos.example/api/v1
```

Required production environment variables:
```bash
NODE_ENV=production
DEPLOY_ENV=staging or production
ALLOW_PROD_BOOT=true
DATABASE_URL
REDIS_HOST
REDIS_PORT
JWT_SECRET
JWT_CHALLENGE_SECRET
MEDICAL_ENCRYPTION_KEY
TOKEN_HASH_PEPPER
JWT_ISSUER
JWT_AUDIENCE_WEB
JWT_AUDIENCE_MOBILE
FRONTEND_ORIGIN
PASSWORD_RESET_APP_URL
NEXT_PUBLIC_API_BASE_URL
TRUST_PROXY=true
```

If using webhook email mode:
```bash
EMAIL_DELIVERY_MODE=webhook
EMAIL_WEBHOOK_URL
EMAIL_WEBHOOK_TOKEN
```

If using R2/object storage:
```bash
STORAGE_PROVIDER=r2
R2_BUCKET
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_REGION=auto
```

Public-base variable names may be required by the current storage adapter, but they must resolve through protected application-controlled access. Never expose a private storage bucket, object key, or storage directory directly through the reverse proxy.

### Cookie, CORS, and Security Rules
- HTTPS is mandatory for staging and production.
- Use `COOKIE_SAME_SITE=lax` for same-site configurations. Use `COOKIE_SAME_SITE=none` only for cross-site HTTPS deployments.
- Browser auth is cookie-first; do not store raw access or refresh tokens in local browser storage.
- Keep `TRUST_PROXY=true` behind the reverse proxy.
- `FRONTEND_ORIGIN` must match the public dashboard origin exactly.
- Keep `EMAIL_DELIVERY_MODE=log` for pilot unless webhook/email credentials are approved. SMS, FCM, and external email providers stay disabled or stubbed unless explicitly configured.
- Payment gateways must stay disabled/mock until sandbox/staging verification is approved.
- Provider failures must not block core admissions, attendance, fees, activity, or notices workflows.

### Email Webhook Delivery Details
When using webhook mode (`EMAIL_DELIVERY_MODE=webhook`), the backend sends a JSON POST to the configured `EMAIL_WEBHOOK_URL` with token verification headers (`EMAIL_WEBHOOK_TOKEN`) and the following JSON payload fields:
- `from`: Sender address
- `to`: Recipient address
- `subject`: Email subject
- `text`: Plain text body
- `html`: HTML formatted body
- `metadata`: Key-value object of delivery details

### API Security Mechanisms
- Access tokens are short-lived.
- Refresh tokens are hashed in the database and rotated on refresh.
- Password reset and MFA codes are hashed in the database and expire automatically.
- OTP issuance is rate-limited per user and purpose.
- User suspension and password reset revoke active refresh sessions.
- Global request throttling is enabled.
- CORS is allowlisted from configured frontend origins only.
- Security headers are added at the app boundary.

### Logs and Monitoring
- Minimum log sources: API process logs, Web process logs, `docker compose logs postgres redis`, Notification processor logs, Reverse proxy logs, Database migration logs.
- Review logs daily during the pilot. Verify API request IDs for bug reports.
- Monitor Redis connections and BullMQ retry errors.

---

## 3. Branch Hygiene, Build, and Verification

### Branch and Release Hygiene
Before deployment:
1. Confirm deployment branch and commit SHA.
2. Ensure no unrelated local changes are included.
3. Record rollback commit/image.
4. Confirm migration and backup owners.
5. Confirm go/no-go decision owner.
6. Confirm staging URL and API URL.
7. Confirm provider modes (disabled, dev-log, mock, or configured).

### Canonical Verification Command
Export or inject the real staging values, then run from repo root before deployment:
```bash
pnpm verify:env:staging
DEPLOY_ENV=staging NODE_ENV=production pnpm verify:deploy
```
Use `pnpm verify:env:production` for production release checks. These commands require real environment values in the shell; placeholders in `.env.example` are intentionally rejected. `verify:deploy` covers: deploy env preflight, tracked artifact guard, Prisma generate/validate, OpenAPI gate, lint, typecheck, unit tests, API E2E, web smoke E2E, and build.

If staging values live in an untracked file, load them without printing secrets:
```bash
DEPLOY_ENV_FILE=/secure/path/schoolos-staging.env pnpm verify:env:staging
DEPLOY_ENV_FILE=/secure/path/schoolos-staging.env DEPLOY_ENV=staging NODE_ENV=production pnpm verify:deploy
```
The env file may contain `DEPLOY_ENV=staging` and `NODE_ENV=production`; shell variables still take precedence over file values.

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
pnpm smoke:pilot          # Legacy alias: pnpm smoke:phase1
SMOKE_LOGIN=true pnpm smoke:pilot
```

For staging smoke, point the same command at deployed services and record the command output with the release evidence:
```bash
SMOKE_API_BASE_URL=https://api-staging.schoolos.example/api/v1 \
DATABASE_URL=postgresql://... \
REDIS_HOST=... \
REDIS_PORT=6379 \
pnpm smoke:pilot
```

---

## 4. Database Backup & Restore Runbook

Release validation requires restorable data, not just backups that appear to exist. Treat this as the baseline operating procedure; it is not verified until a dated restore record exists.

### Backup Scope & Frequency
- **Postgres:** full backup daily (and WAL archiving once live). Captures tenant records, accounting ledger, audit records, sessions, and module data.
- **Redis:** append-only persistence or RDB snapshots to preserve BullMQ queue states.
- **Storage:** daily incremental sync and weekly full verification of uploaded files and generated PDFs.
- **Configuration:** backup of `.env`, proxy config, Docker Compose files, and release SHA on every deployment/secret rotation.

### Backup Commands
Postgres backup:
```bash
pg_dump --format=custom --file=/backups/schoolos-before-$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
```
Storage backup:
```bash
tar -czf /backups/schoolos-storage-before-$(date +%Y%m%d%H%M).tgz /var/lib/schoolos/storage
```
Store backups outside the VPS as soon as possible.

### Restore Drill
1. Provision a clean test database.
2. Restore the Postgres backup:
   ```bash
   pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" /backups/latest.dump
   ```
3. Restore storage files to the test storage root.
4. Start API with restore database/storage values.
5. Verify `/api/v1/ready`.
6. Verify login, tenant data, admission documents, receipts, ledger reports, and notification delivery records.
7. Record restore duration and verify monthly.

### Database Rollback Options
1. Stop API and web traffic.
2. Redeploy the previous known-good image or commit.
3. Run `pnpm db:generate` after checkout if dependencies changed.
4. Restore database/storage only if the failed release wrote incompatible or corrupt data.
5. Never hard-delete financial, attendance, student, or audit records during rollback. Prefer corrective records or restoring a snapshot.

---

## 5. Controlled-Pilot Onboarding and Operations

This section outlines onboarding a controlled-pilot school onto the agreed supported workflow slice. Use it only after staging health and smoke checks have actually passed and their evidence has been recorded.

### Local/Staging Startup Quick Reference
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start PostgreSQL and Redis:
   ```bash
   docker compose up -d postgres redis
   docker compose ps
   ```
3. Prepare database:
   ```bash
   pnpm db:generate
   pnpm db:validate
   pnpm db:migrate
   pnpm db:seed
   ```
4. Start apps:
   ```bash
   pnpm dev
   ```

Use the current idempotent development seed and retrieve local QA credentials from the seed implementation or approved secure development configuration. Do not reuse seed credentials in staging or production.

Expected URLs:
- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api/v1/docs`

### Pre-Pilot Checklist
- Confirm school/tenant name and branding expectations.
- Confirm current academic year.
- Create or verify classes, sections, fee heads, and fee plans.
- Create admin, teacher, and accountant/cashier users.
- Verify notification providers are stubbed or explicitly configured.
- Verify `FRONTEND_ORIGIN`, cookies, CORS, and HTTPS settings.
- Verify `LOCAL_STORAGE_ROOT` exists and is backed up.
- Run the applicable deployment verification and `pnpm smoke:pilot`; attach outputs to the current evidence record.
- Run browser smoke with PDF checks.

### Staff Training Checklist
Train in this order:
1. **Admin Command Center:** KPIs, setup alerts, quick actions, and delivery health.
2. **Settings:** academic year, class, and section setup.
3. **Student Directory/Profile:** filter roster, search by name/SCH ID, open profile, open ID card PDF, jump to fee collection.
4. **New Enrollment:** multi-step admission, guardian phone, iEMIS disability confirmation, duplicate warning, document upload, success actions.
5. **Attendance:** class/section/date register, present-by-default support, absent/late/leave exceptions, draft/submit result, lock/conflict state.
6. **Fee Collection:** invoice search, outstanding amount, overpayment block, partial/full payment, receipt PDF, ledger preview.
7. **Activity Feed:** audience targeting, 1-5 image rule, private media object-key behavior, feed preview, delivery records.
8. **Notices/Communications:** normal/urgent/emergency notice, event creation, delivery records, guardian consent capture/revoke.
9. **Logout/session behavior:** avatar menu logout.

### Day-1 Pilot Script
1. Log in as admin.
2. Confirm academic year, class, section, fee head, and fee plan exist.
3. Admit 2-5 test students with guardian phone numbers. Verify `SCH-YYYY-NNNN` IDs.
4. Open one Student ID Card PDF.
5. Confirm first invoice exists.
6. Collect one partial fee payment. Open generated receipt PDF.
7. Mark one student absent, one late, and one leave in class Attendance. Submit and verify notifications queued.
8. Publish one normal notice and one event.
9. Capture and revoke one guardian consent record.
10. Create one activity post with one image.
11. Confirm delivery records appear for notice/activity/attendance/fee events.
12. Log out and confirm dashboard redirect.

### Browser QA Checklist
- **Authentication:** Login works with cookie-first auth. No raw tokens in browser storage. Logout clears local session metadata. Unauthenticated access redirects to login.
- **Setup:** Academic year, class, section, fee head, fee plan exist. Setup alerts clear.
- **Admissions:** Student Directory is default. Search works. Profile panel sections load. ID Card PDF opens. New enrollment requires guardian phone and iEMIS disability confirmation. Duplicate warnings and roll conflicts function.
- **Attendance:** Roster loads. All Present default. Exceptions cycle. Future dates blocked. Submit succeeds and queues notifications. Locked session displays correct state.
- **Fees:** Invoice search works. Overpayment blocked. Partial payment succeeds. Receipt success panel appears. Receipt PDF opens. Ledger preview is labeled preview-only.
- **Activity:** Target selection clear. Upload blocks >5 images. Feed preview shows new post. Delivery record is queued.
- **Communications:** Normal notice publishes. Emergency warning appears for emergency priority. Event creation works. Delivery records list statuses. Guardian consent capture/revoke works.

### Controlled-Pilot Boundaries
- The supported workflow slice must be recorded for each pilot; module presence in the repository does not prove that a workflow is pilot validated.
- Parent mobile workflows exist in the repository, but supported-persona device QA and tenant/child-scope evidence are still required before a pilot-validation claim.
- Real SMS, FCM, external email, payment, and object-storage modes remain unavailable unless explicitly configured and verified in a safe staging or sandbox environment.
- M14 Intelligence / AI runtime and a broad Student App remain out of active scope.
- Local storage is acceptable for a controlled pilot only when protected access, backup, and restore procedures are configured and evidenced.

### Support Process & Severity Levels
- **S0 (Critical):** Data loss, cross-tenant data exposure, login unavailable, or financial corruption. Stop pilot writes and escalate immediately.
- **S1 (High):** Core flows (admissions, attendance, fees, notices) blocked for pilot staff. Fix before next school day.
- **S2 (Medium):** Workaround exists but staff workflow is degraded. Same-week fix.
- **S3 (Low):** Copy, visual polish, minor layout, or deferred enhancements. Backlog.

---

## 6. Release Go/No-Go Checklist

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
