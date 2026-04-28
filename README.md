# SchoolOS

SchoolOS is now structured as a `pnpm` monorepo centered on a multi-tenant NestJS backend and a Next.js admin web app for Nepal-ready school operations.

## Workspace Layout

- `apps/api`
  - NestJS + Prisma backend
  - auth, RBAC, admissions, attendance, finance, academics, payroll, accounting, library, transport, notices, and messaging
- `apps/web`
  - Next.js App Router admin/staff frontend
  - tenant registration, login, dashboard, admissions, attendance, finance, and communications flows
- `packages/core`
  - shared validation schemas, permission keys, and DTO-style TypeScript types

## Core Platform Decisions

- Multi-tenant SaaS remains the primary deployment model.
- Web admin/staff is the only frontend implemented in the first phase.
- API routes are versioned under `/api/v1`.
- Swagger docs are exposed from the API at `/api/v1/docs`.
- Fee payments post journal entries into the accounting ledger automatically.

## Local Development

1. Install workspace dependencies.

```bash
pnpm install
```

2. Copy the API env file if needed.

```bash
cp apps/api/.env.example apps/api/.env
```

3. Start local Postgres and Redis.

```bash
docker compose up -d postgres redis
```

The default API env file targets Docker Postgres on `localhost:5433` and Redis
on `localhost:6379`.

4. Generate the Prisma client and apply migrations.

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

5. Start the API and web app together.

```bash
pnpm dev
```

Expected local URLs:

| Service | URL |
|---------|-----|
| Web app | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/api/v1/docs` |
| Health | `http://localhost:4000/api/v1/health` |
| Readiness | `http://localhost:4000/api/v1/ready` |

If either server reports `EADDRINUSE`, another process is already listening on
that port. Check it with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or
`lsof -nP -iTCP:4000 -sTCP:LISTEN`, stop the stale process, then run
`unset PORT` before restarting `pnpm dev`.

Sensitive medical/compliance fields are encrypted at the app layer before they
are stored. Local development uses a safe fallback key, but production must set
`MEDICAL_ENCRYPTION_KEY` to a stable 32-byte hex/base64 value, or a long secret
passphrase, before admitting students with medical data.

## Workspace Commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm smoke:phase1`
- `pnpm verify:production`

## Production Operations

- Docker VPS baseline: [docs/production/docker-vps-runbook.md](/Users/erwin/Desktop/SchoolOS/docs/production/docker-vps-runbook.md)
- Phase 1 pilot readiness: [docs/production/phase1-pilot-readiness.md](/Users/erwin/Desktop/SchoolOS/docs/production/phase1-pilot-readiness.md)
- Backup and restore baseline: [docs/production/backup-restore-runbook.md](/Users/erwin/Desktop/SchoolOS/docs/production/backup-restore-runbook.md)

Production API startup validates required secrets, CORS origins, Redis, database,
cookie, encryption, and provider settings before listening.

The Next.js dashboard authenticates browser API calls with `httpOnly` access and
refresh cookies. The backend still returns access tokens in JSON for direct
API/mobile compatibility, but the dashboard persists only non-sensitive session
metadata in browser storage.

## Default Login Credentials

After running `pnpm db:seed`, the following local demo accounts are available:

| Field       | Value               |
|-------------|---------------------|
| Tenant Slug | `default-school`    |
| Email       | `admin@schoolos.com`|
| Password    | `admin123`          |

Use this account when you need every permission in the default tenant:

| Field       | Value                     |
|-------------|---------------------------|
| Tenant Slug | `default-school`          |
| Email       | `superadmin@schoolos.com` |
| Password    | `superadmin123`           |

## Current Backend Surface Area

- Platform/auth/RBAC with tenant onboarding, users, roles, super-admin support, refresh sessions, audit records, and provider-neutral adapters.
- Phase 1 core: admissions, student documents/certificates, attendance, fees, activity feed, notices, consent, deliveries, receipts, and immutable ledger posting.
- Phase 2 core: academics, timetable/homework, HR/payroll, accounting reports, and messaging.
- Phase 3 core: library and transport backend APIs with delivery and finance integration foundations.

## Deferred / Last

- Parent and teacher mobile apps
- Real SMS/push/R2 provider credentials until adapters are selected
- Payment gateways such as eSewa/Khalti until manual/bank/cash reconciliation is production-ready
- AI integrations until consent, moderation, storage, and messaging foundations are production-ready
