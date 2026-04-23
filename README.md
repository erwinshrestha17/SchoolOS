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

## Workspace Commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:seed`

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
