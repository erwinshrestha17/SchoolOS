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
ACCESS_COOKIE_NAME=school_os_access_token
REFRESH_COOKIE_NAME=school_os_refresh_token
COOKIE_SAME_SITE=lax
```

Production must replace local JWT/encryption secrets with stable values of at
least 32 characters. Do not run production with the example secrets.

## Browser Auth Flow

The current Next.js dashboard authenticates browser API calls with `httpOnly`
cookies issued by the Nest API:

- Login sets a short-lived `ACCESS_COOKIE_NAME` cookie and rotating
  `REFRESH_COOKIE_NAME` cookie.
- Protected API requests use `credentials: include`; browser JavaScript does not
  attach bearer tokens.
- The web app stores only non-sensitive session metadata such as user, tenant,
  roles, and permissions.
- API `401` responses clear local metadata and the API client attempts one
  refresh-cookie rotation before failing a protected request.
- Production deployments must use HTTPS. Set `COOKIE_SAME_SITE=none` only for
  cross-site HTTPS deployments behind a trusted proxy.

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

- The temporary Next.js dashboard no longer persists client-readable tokens, but
  login/refresh JSON responses still include access tokens for direct API and
  future mobile compatibility. A future BFF route layer can remove token-bearing
  JSON from browser-visible responses entirely.
- Real SMS, FCM, email webhook, R2, payment gateway, and AI providers remain
  adapter-ready but not enabled for the pilot baseline.
- The current automated e2e harness is mocked for speed and isolation. Before a
  live school, run the browser smoke checklist against Docker Postgres/Redis and
  keep screenshots/logs from the pass.

## 10. Browser QA Result - 2026-04-29

Pilot browser QA was run against local Docker Postgres, Docker Redis, the real
NestJS API on `localhost:4000`, and the current Next.js dashboard on
`localhost:3000`.

### Result

Decision: ready for a controlled pilot after one manual media-upload check.

### Passed Checks

- Docker Postgres and Redis were healthy.
- `SMOKE_LOGIN=true pnpm smoke:phase1` passed Postgres, Redis, API health,
  readiness, and seeded admin login checks.
- Cookie-first login succeeded for `default-school` / `admin@schoolos.com`.
- Logout redirected to `/login`, and direct dashboard access after logout
  redirected to `/login?next=/dashboard`.
- Settings showed the seeded current academic year `2026-2027`, classes, and
  sections.
- Admissions created a student with explicit iEMIS no-disability confirmation,
  guardian phone, generated `SCH-2026-0003`, and created the first invoice
  `INV-2025-2026-00001`.
- Attendance loaded the Class 1 / Section A roster, treated students as present
  by default, submitted absent and late exceptions, showed conflict-review state,
  and queued parent-notification messaging.
- Fee Collection displayed the outstanding invoice, blocked overpayment in the
  browser, recorded a partial cash payment, generated receipt
  `REC-2025-2026-00001`, and kept ledger posting as backend-owned preview-only
  UI.
- Notices showed the emergency warning, published a normal notice, created an
  event, and listed provider-neutral delivery records.
- Guardian photo-consent capture and revoke both updated the consent status
  cards.
- Cross-page shell checks passed: sidebar links, academic year header,
  notification badge query, empty states, and user menu remained stable.
- No raw backend JSON error blob was observed during the browser pass.

### Bugs Fixed During This Pass

No new code defects were found during this browser pass. The prior iEMIS
disability-confirmation blocker was verified fixed through the admissions
journey.

### Remaining Caveats

- The in-app browser automation runtime used for this pass could not attach a
  local image file to the Activity Feed file input. Activity Feed page structure,
  class/section targeting, 1-5 image rule copy, private media messaging, and
  disabled publish-without-image behavior were verified; the actual one-image
  upload/publish should be checked manually in Chrome/Safari before school staff
  training.
- Browser storage inspection is covered by web contract tests rather than this
  browser runtime because the runtime does not expose a safe localStorage API.
- Real external SMS, FCM, email, R2, payment gateways, and AI remain intentionally
  disabled for the controlled pilot.
