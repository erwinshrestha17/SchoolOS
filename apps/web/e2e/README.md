# Web browser smoke tests

Browser smoke coverage verifies public routes, authenticated school-admin navigation, optional platform checks, and role/persona boundaries for real SchoolOS workflows.

The Playwright config is available at `apps/web/playwright.config.ts`.

The active persona matrix lives in `docs/testing/SCHOOLOS_WEB_MOBILE_PERSONA_SMOKE_PLAN.md`.

## Local authenticated smoke

Authenticated smoke tests use the real cookie-first login form and seeded local/dev accounts. Start Docker Postgres/Redis, run migrations/seed, and start the API before running the full authenticated checks.

Override the seeded account used by Playwright with:

```bash
SCHOOLOS_E2E_TENANT_SLUG=<tenant-slug> \
SCHOOLOS_E2E_EMAIL=<seeded-school-admin-email> \
SCHOOLOS_E2E_PASSWORD=<seeded-school-admin-password> \
pnpm test:web:e2e
```

If the API is not reachable at `http://localhost:4000/api/v1`, authenticated browser smoke tests skip with a clear message so `verify:production` remains usable in non-live environments. Public smoke still runs.

Platform smoke is optional and runs only when platform seed credentials are supplied:

```bash
SCHOOLOS_E2E_PLATFORM_TENANT_SLUG=<tenant-slug> \
SCHOOLOS_E2E_PLATFORM_EMAIL=<seeded-platform-email> \
SCHOOLOS_E2E_PLATFORM_PASSWORD=<seeded-platform-password> \
pnpm test:web:e2e
```

## Persona smoke expectations

Every persona smoke should prove that the user:

```text
1. Can log in successfully.
2. Lands on the correct dashboard or home screen.
3. Sees navigation that matches role permissions.
4. Gets a safe permission/module-locked state for forbidden direct routes.
5. Sees only allowed tenant-scoped records.
6. Can perform permitted actions with loading/success/error handling.
7. Cannot perform forbidden actions.
8. Can log out safely and is redirected after session expiry.
```

Priority personas:

```text
Platform Operator
Principal / Head Teacher
School Admin / Office Admin
Admission Officer
Class Teacher
Subject Teacher
Accountant / Cashier
HR / Payroll Officer
Librarian
Transport Manager
Driver / Conductor
Canteen Manager / POS Staff
Parent / Guardian
Student Lab-Only User
Staff Self-Service User
```

Module smoke must stay real-API backed. Do not use fake data, browser-only role assumptions, or admin-shaped payloads for parent, driver, staff, or lab/student-scoped checks.
