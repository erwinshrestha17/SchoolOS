# SchoolOS

SchoolOS is now structured as a `pnpm` monorepo centered on a multi-tenant NestJS backend and a Next.js admin web app for Nepal-ready school operations.

## Workspace Layout

- `apps/api`
  - NestJS + Prisma backend
  - auth, RBAC, admissions, attendance, finance, notices, and events
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

3. Generate the Prisma client and apply migrations.

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

4. Start the API and web app together.

```bash
pnpm dev
```

Expected local URLs:

| Service | URL |
|---------|-----|
| Web app | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/api/v1/docs` |

If either server reports `EADDRINUSE`, another process is already listening on
that port. Check it with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or
`lsof -nP -iTCP:4000 -sTCP:LISTEN`, stop the stale process, then run
`unset PORT` before restarting `pnpm dev`.

## Workspace Commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`

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

## Current Phase 1 Surface Area

- Tenant onboarding and admin login
- Users, roles, staff, classes, academic years, and sections
- Admissions with guardian linkage and enrollment records
- Student attendance sessions with present-by-default submission
- Fee heads, fee plans, invoices, payment collection, receipts, and journal entries
- Notices and events with audience targeting

## Deferred From This Phase

- Parent and teacher mobile apps
- Payroll, bank reconciliation, and budget management
- Library, transport, and the full advanced academics surface
