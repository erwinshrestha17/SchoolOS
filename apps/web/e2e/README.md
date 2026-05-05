# Web browser smoke tests

Phase 2F.2 browser smoke coverage verifies public routes plus authenticated school-admin navigation across Phase 1B pilot workflows and Phase 2 shell readiness.

The Playwright config is available at `apps/web/playwright.config.ts`.

## Local authenticated smoke

Authenticated smoke tests use the real cookie-first login form and seeded local/dev accounts. Start Docker Postgres/Redis, run migrations/seed, and start the API before running the full authenticated checks.

Default school-admin credentials:

```text
tenantSlug: default-school
email: admin@schoolos.com
password: admin123
```

Override with:

```bash
SCHOOLOS_E2E_TENANT_SLUG=default-school \
SCHOOLOS_E2E_EMAIL=admin@schoolos.com \
SCHOOLOS_E2E_PASSWORD=admin123 \
pnpm test:web:e2e
```

If the API is not reachable at `http://localhost:4000/api/v1`, authenticated browser smoke tests skip with a clear message so `verify:production` remains usable in non-live environments. Public smoke still runs.

Platform smoke is optional and runs only when platform seed credentials are supplied:

```bash
SCHOOLOS_E2E_PLATFORM_TENANT_SLUG=default-school \
SCHOOLOS_E2E_PLATFORM_EMAIL=platform@schoolos.com \
SCHOOLOS_E2E_PLATFORM_PASSWORD=platform123 \
pnpm test:web:e2e
```
