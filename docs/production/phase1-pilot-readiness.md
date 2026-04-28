# SchoolOS Phase 1 Pilot Readiness

This checklist is for running the current Phase 1 Web + API stack with local
Docker Postgres and Redis before a pilot-school browser pass.

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Start Postgres And Redis

```bash
docker compose up -d postgres redis
docker compose ps
```

Expected local infrastructure:

| Service | Host URL |
| --- | --- |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |

The compose file includes container health checks for both services. If either
service is unhealthy, inspect logs with `docker compose logs postgres redis`.

## 3. Configure API Environment

```bash
cp apps/api/.env.example apps/api/.env
```

For Docker-backed local development, keep:

```bash
DATABASE_URL=postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_ORIGIN=http://localhost:3000
EMAIL_DELIVERY_MODE=log
STORAGE_PROVIDER=local
```

Production must replace local JWT/encryption secrets with stable values of at
least 32 characters. Do not run production with the example secrets.

## 4. Prepare Database

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

`pnpm db:seed` is explicit on purpose. It adds or updates baseline roles,
permissions, chart accounts, fee heads, academic year, and local admin users; do
not run it against production unless intentionally provisioning baseline data.

## 5. Start The Apps

```bash
pnpm dev
```

Expected URLs:

| Service | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/api/v1/docs` |
| Health | `http://localhost:4000/api/v1/health` |
| Readiness | `http://localhost:4000/api/v1/ready` |

## 6. Smoke Test Runtime Connectivity

With Docker services running, validate Postgres and Redis:

```bash
SMOKE_SKIP_API=true pnpm smoke:phase1
```

With API running on port `4000`, validate API health/readiness too:

```bash
pnpm smoke:phase1
```

After seeding, you can also validate login:

```bash
SMOKE_LOGIN=true pnpm smoke:phase1
```

Default seeded accounts:

| Tenant | Email | Password |
| --- | --- | --- |
| `default-school` | `admin@schoolos.com` | `admin123` |
| `default-school` | `superadmin@schoolos.com` | `superadmin123` |

## 7. Production Verification

Run the full local gate before a pilot handoff:

```bash
pnpm verify:production
```

This runs tracked-artifact checks, Prisma generate/validate, OpenAPI gate,
lint, typecheck, unit tests, e2e tests, and production builds.

## 8. Browser Smoke Checklist

Use the seeded admin or register a fresh tenant, then verify:

- Create or confirm academic year.
- Create class and section from Settings.
- Configure a fee head and fee plan.
- Admit a student with at least one guardian phone number.
- Confirm duplicate warning and roll-number conflict handling when applicable.
- Confirm the admission-created invoice appears when a fee plan exists.
- Mark attendance using present-by-default exceptions.
- Confirm out-of-roster students are rejected by the API.
- Create an activity post and verify attachments store private object keys.
- Publish a notice/event.
- Check notification delivery records for admissions, attendance, fees,
  activity, and notice/event workflows.

## 9. Known Pilot Limitations

- The temporary Next.js dashboard still stores the short-lived access token in
  centralized browser storage. The backend refresh token is httpOnly, and API
  `401` responses now clear client state, but the longer-term production target
  is a cookie/BFF session model with no client-readable access token.
- Real SMS, FCM, email webhook, R2, payment gateway, and AI providers remain
  adapter-ready but not enabled for the pilot baseline.
- The current automated e2e harness is mocked for speed and isolation. Before a
  live school, run the browser smoke checklist against Docker Postgres/Redis and
  keep screenshots/logs from the pass.
