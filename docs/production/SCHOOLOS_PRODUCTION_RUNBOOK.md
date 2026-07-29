# SchoolOS Production Runbook

**Last updated:** 2026-07-12
**Status:** Consolidated active production runbook, deployment manual, database backup/restore procedures, and pilot onboarding guidelines.  
**Architecture:** NestJS modular monolith, PostgreSQL, Redis/BullMQ, private storage.

This runbook defines deployment, recovery, and controlled-pilot operating procedures. It is not proof that any procedure has been executed or that SchoolOS has passed a release gate. The current posture is **Internal QA / controlled-pilot preparation**. Current work and blockers belong in GitHub Issues, Milestones, or Projects; current evidence belongs in CI runs, smoke outputs, staging records, and release artifacts.

The active education scope is School (Grade 1-10) and Higher Secondary (Grade 11-12 / +2) over one tenant-aware core; Preschool is out of scope. A broad Student App and M14 Intelligence / AI runtime are not active scope.

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
RATE_LIMIT_ENABLED=true
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
RATE_LIMIT_ENABLED=true
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

### Repository scripts (local and staging)

Use the executable scripts in `scripts/` rather than ad hoc commands when possible:

| Command | Purpose |
| --- | --- |
| `pnpm backup:local` | Postgres custom-format dump + local storage tar + manifest metrics |
| `pnpm restore:local -- --manifest .backups/<timestamp>/manifest.json` | Restore into `RESTORE_DATABASE_URL` and isolated storage dir |
| `pnpm rehearse:backup-restore:local` | End-to-end local drill (backup → restore DB `schoolos_db_restore` → verify counts → write evidence) |

Environment variables:

- `DATABASE_URL` — source database (defaults to local docker Postgres on `:5433`)
- `RESTORE_DATABASE_URL` — restore target (defaults to `schoolos_db_restore` on the same instance)
- `LOCAL_STORAGE_ROOT` — relative to `apps/api/` (default `storage`)
- `BACKUP_OUTPUT_DIR` — artifact root (default `.backups/`, gitignored)
- `RESTORE_STORAGE_ROOT` — isolated restore storage path (rehearsal never overwrites live storage)
- `ALLOW_RESTORE_INPLACE=1` — required to restore into the same database name as `DATABASE_URL`

Record evidence using [`docs/production/evidence/BACKUP_RESTORE_REHEARSAL_TEMPLATE.md`](evidence/BACKUP_RESTORE_REHEARSAL_TEMPLATE.md). Local rehearsal example: [`docs/production/evidence/backup-restore-rehearsal-2026-07-29-local.md`](evidence/backup-restore-rehearsal-2026-07-29-local.md).

Local quick start:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed   # if source DB is empty
pnpm rehearse:backup-restore:local
```

If `pg_dump` / `pg_restore` are not installed on the host, the scripts fall back to `docker exec schoolos_postgres` when that container is running.

### Backup Scope & Frequency
- **Postgres:** full backup daily (and WAL archiving once live). Captures tenant records, accounting ledger, audit records, sessions, and module data.
- **Redis:** append-only persistence or RDB snapshots to preserve BullMQ queue states (deferred for first local evidence; queue state is recoverable).
- **Storage:** daily incremental sync and weekly full verification of uploaded files and generated PDFs. Local pilot uses `STORAGE_PROVIDER=local`; S3/R2 backup is a staging/production follow-up.
- **Configuration:** backup of `.env`, proxy config, Docker Compose files, and release SHA on every deployment/secret rotation.

### Production / VPS manual commands (override path)

Postgres backup:
```bash
pg_dump --format=custom --no-owner --no-acl --file=/backups/schoolos-before-$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
```
Storage backup:
```bash
tar -czf /backups/schoolos-storage-before-$(date +%Y%m%d%H%M).tgz /var/lib/schoolos/storage
```
Store backups outside the VPS as soon as possible.

### Restore Drill
1. Provision a clean test database (`RESTORE_DATABASE_URL` must differ from source unless `ALLOW_RESTORE_INPLACE=1`).
2. Restore the Postgres backup:
   ```bash
   pnpm restore:local -- --manifest /backups/<timestamp>/manifest.json
   ```
   Or manually:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" /backups/latest.dump
   ```
3. Restore storage files to the test storage root.
4. Start API with restore database/storage values.
5. Verify `/api/v1/ready`.
6. Verify login, tenant data, admission documents, receipts, ledger reports, and notification delivery records.
7. Record restore duration and verify monthly using the evidence template.

### Local staging simulation (development workstation)

```bash
pnpm staging:deploy:local          # postgres:5434, redis:6380, migrate, seed
node scripts/start-staging-api-local.mjs   # API on :4000 against staging DB
pnpm staging:verify:def            # automated DEF subset
pnpm staging:health              # /health + /ready polling
pnpm staging:verify:gates        # db:validate, smoke, backup (API must be running)
```

Full containerized stack:

```bash
docker compose -p schoolos-staging -f docker-compose.staging.yml --profile app up -d --build
```

Evidence templates: `docs/production/evidence/`.

### Monitoring and alerts (minimum pilot)

- Poll `GET /api/v1/health` for process liveness (expect 200).
- Poll `GET /api/v1/ready` for dependency readiness (expect 200; **503 when degraded**).
- Alert on: readiness 503 sustained > 2 minutes, error rate spike, queue depth growth, disk usage on Postgres/storage volumes.
- Use `pnpm staging:health` in cron or CI until APM is configured.

---
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

Use the current idempotent development seed and retrieve local QA credentials from the seed implementation or approved secure development configuration. Routine reseeds preserve existing demo passwords and their completed temporary-password state. Set `SCHOOLOS_DEMO_RESET_CREDENTIALS_ON_SEED=true` or `PLATFORM_SEED_RESET_CREDENTIALS_ON_SEED=true` only for an intentional local credential reset. Do not reuse seed credentials in staging or production.

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

Train in this order. **Wave-gated modules** (M3 full collection, M7, M8, M11) apply only after the school has that module entitled per the GA wave matrix in `SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md` §14.1.

1. **Admin Command Center:** KPIs, setup alerts, quick actions, and delivery health.
2. **Settings:** academic year, class, and section setup.
3. **Student Directory/Profile:** filter roster, search by name/SCH ID, open profile, open ID card PDF.
4. **New Enrollment:** multi-step admission, guardian phone, iEMIS disability confirmation, duplicate warning, document upload, success actions.
5. **Attendance:** class/section/date register, present-by-default support, absent/late/leave exceptions, draft/submit result, lock/conflict state.
6. **Homework and Timetable (M6):** assign homework, review submissions, read teacher timetable.
7. **M12 Notifications and M15 Notices:** normal/urgent/emergency notice with optional Nepali bilingual title/body, category, and pin-to-top; recipient preview; guardian consent capture/revoke; chat-write denial on legacy routes.
8. **Fee Collection (M3 — Wave 2+ only):** invoice search, partial/full payment, receipt PDF, ledger preview. Skip until Wave 2 exit gate.
9. **Activity Feed (M5):** audience targeting, image rule, feed preview, delivery records.
10. **HR & Payroll (M7 — Wave 4+ only):** staff directory, leave, payroll run workflow, payslip PDF. Skip until Wave 4 exit gate and Nepal statutory verification for payroll.
11. **Library (M8 — Wave 4+ only):** catalogue, issue/return, fines. Skip until Wave 4 exit gate.
12. **Accounting & Finance (M11 — Wave 4+ only):** chart of accounts, journals, fiscal periods, reports. Skip until Wave 4 exit gate.
13. **Logout/session behavior:** avatar menu logout.

### Day-1 Production School Script (Wave 1 core)

Execute steps 1–11 for the first production school. Steps 12–15 require Wave 2–4 module entitlements.

1. Log in as admin.
2. Confirm academic year, class, and section exist.
3. Admit 2–5 students with guardian phone numbers. Verify `SCH-YYYY-NNNN` IDs.
4. Open one Student ID Card PDF.
5. Mark one student absent, one late, and one leave in class Attendance. Submit and verify notifications queued.
6. Publish one normal notice. Confirm recipient preview matches publication.
7. Capture and revoke one guardian consent record.
8. Create one activity post with one image (if M5 entitled).
9. Assign one homework item (M6).
10. Confirm delivery records appear for notice/activity/attendance events.
11. Log out and confirm dashboard redirect.

**Wave 2+ extensions (when entitled):**

12. Confirm first invoice exists; collect one partial fee payment; open receipt PDF (M3).
13. Create staff member, leave request, payroll run, payslip PDF (M7 — after statutory verification).
14. Issue and return one library copy (M8).
15. Create one manual journal entry, approve, post, export Trial Balance (M11).

### Browser QA Checklist
- **Authentication:** Login works with cookie-first auth. No raw tokens in browser storage. Logout clears local session metadata. Unauthenticated access redirects to login.
- **Setup:** Academic year, class, section, fee head, fee plan exist. Setup alerts clear.
- **Admissions:** Student Directory is default. Search works. Profile panel sections load. ID Card PDF opens. New enrollment requires guardian phone and iEMIS disability confirmation. Duplicate warnings and roll conflicts function.
- **Attendance:** Roster loads. All Present default. Exceptions cycle. Future dates blocked. Submit succeeds and queues notifications. Locked session displays correct state.
- **Fees:** Invoice search works. Overpayment blocked. Partial payment succeeds. Receipt success panel appears. Receipt PDF opens. Ledger preview is labeled preview-only.
- **Activity:** Target selection clear. Upload blocks >5 images. Feed preview shows new post. Delivery record is queued.
- **M12 Notifications and M15 Notices:** Normal notice publishes through the normalized event handoff. Emergency warning appears for emergency priority and requires approval before dispatch. Optional Nepali title/body, category, and pin save and reload correctly. Role/staff/specific-student/specific-guardian/specific-recipient audience selections resolve to the actual matching population (recipient preview uses the identical backend resolver used at publish time — no browser-side audience guessing). Delivery records distinguish in-app success from skipped/failed external providers. Guardian consent capture/revoke and consent-template management require admin/school-configuration-owner permission — a teacher, student, or parent session cannot reach `/consents` or consent-template routes even though it can manage its own notification preferences. Every legacy chat/messaging route (`/dashboard/messages*`, `/dashboard/messaging`) renders the removed-state stub with no live compose or thread-creation controls.
- **HR & Payroll (M7):** Staff directory/profile loads and is tenant-scoped. Staff attendance register and leave request/approval enforce overlap and staff-status checks. Salary structure activation blocks overlapping effective windows. Payroll readiness surfaces blocking exceptions (missing salary structure/contract, zero gross pay, negative net pay, missing PAN/bank/account mapping) before Submit for Review is allowed. Approve/Post actions are gated by the run's allowed-actions state. Payslip PDF opens via an authenticated stream, not a public link. Staff self-service (profile/leave/payslip) is limited to the signed-in staff member's own records.
- **Library (M8):** Book/copy catalogue loads and archive requires an audit reason. Scanner-assisted issue blocks a copy that is already checked out; return clears it back to available and calculates any overdue fine. Reservations block issuing a reserved copy to a different borrower. A teacher's issue/reservation history and borrowed-students roster stay scoped to their own records, never school-wide. Fines can be waived or posted to the M3 Fees counter with a mandatory audit reason. Parent linked-child library status is read-only and limited to the linked child.
- **Accounting & Finance (M11):** Chart of accounts and Nepal chart template import work. Manual journal and voucher entry require a balanced double-entry before submission, and posting is blocked outside an open, unlocked fiscal period. A journal cannot be approved by the same user who created it. Bank statement import and reconciliation match statement lines to journal lines. Trial Balance, General Ledger, Cash Book, Income Statement, Balance Sheet, and Tax Summary reports load and export. The principal role sees financial reports and summaries read-only, with no journal approve/post/reverse, fiscal management, or accounting settings-update actions available.

### Controlled-Pilot / Wave 1 Production Boundaries

- The supported workflow slice must match the GA wave matrix in `SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md` §14.1.
- Wave 1 production school #1 enables M0, M1, M2, M5, M6, M12, M15 only until later wave exit gates pass.
- Parent mobile workflows require device QA and tenant/child-scope evidence before production claims.
- Real SMS, FCM, external email, payment, and object-storage modes require safe staging/sandbox verification.
- M14 Intelligence / AI runtime and a broad Student App remain out of active scope.
- M13 Learning ships in Wave 5; keep disabled until that wave's evidence is recorded.

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
