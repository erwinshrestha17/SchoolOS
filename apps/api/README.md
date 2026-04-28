# School OS Auth Backend

Multi-tenant NestJS backend for school management with:

- tenant registration for SaaS onboarding
- JWT access tokens plus rotating refresh cookies
- role and permission based access control
- admin-managed users, staff, students, and classes
- email OTP for MFA setup, OTP login, and password recovery
- audit logging, throttling, and environment-driven CORS/cookie policy

## Core flows

### Tenant and admin onboarding
- `POST /tenants/register`
- creates the school tenant
- provisions default roles and permissions
- creates the first admin account

### Auth
- `POST /auth/login`
  - password login for `PASSWORD` users
  - returns MFA challenge for `BOTH` users
- `POST /auth/otp/request-login`
  - starts OTP-only login for `OTP` users
- `POST /auth/otp/verify`
  - completes OTP or MFA login and issues a session
- `POST /auth/password-recovery/request`
- `POST /auth/password-recovery/confirm`
- `POST /auth/mfa/setup/request`
- `POST /auth/mfa/setup/confirm`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Admin operations
- `GET /users`
- `POST /users`
- `PATCH /users/:id/status`
- `POST /users/:id/reset-password`
- `GET /roles`
- `GET /roles/permissions`
- `POST /roles`
- `POST /roles/assign`
- `POST /roles/:id/permissions`
- `GET /classes`
- `POST /classes`
- `GET /staff`
- `POST /staff`
- `GET /students`
- `POST /students`
- `GET /tenants/me`

## Local setup

1. Copy the env template.

```bash
cp .env.example .env
```

2. Generate Prisma client, run migrations, and seed the database.

```bash
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
```

3. Start the API.

```bash
pnpm start:dev
```

4. Verify build and tests.

```bash
pnpm type:check
pnpm test --runInBand
pnpm exec jest --config ./test/jest-e2e.json --runInBand
```

## Frontend domain and cookie policy

The browser dashboard uses `httpOnly` cookies for both the short-lived access
token and the rotating refresh token. Direct API/mobile clients can still use
the access token returned in the JSON response. Configure these values to match
the frontend you will deploy:

- `FRONTEND_ORIGIN`
  - primary frontend origin, for example `https://app.schoolos.com`
- `FRONTEND_ORIGINS`
  - comma-separated extra origins if you have multiple frontends
- `COOKIE_DOMAIN`
  - set this when frontend and backend share a parent domain
- `ACCESS_COOKIE_NAME`
  - defaults to `school_os_access_token`
- `REFRESH_COOKIE_NAME`
  - defaults to `school_os_refresh_token`
- `COOKIE_SAME_SITE`
  - use `none` for cross-site cookie delivery over HTTPS
  - use `lax` for same-site or local development
- `TRUST_PROXY`
  - set `true` behind a reverse proxy or load balancer

Recommended production example:

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://app.schoolos.com
COOKIE_DOMAIN=.schoolos.com
COOKIE_SAME_SITE=none
TRUST_PROXY=true
ACCESS_COOKIE_NAME=school_os_access_token
REFRESH_COOKIE_NAME=school_os_refresh_token
```

## Email delivery

Two delivery modes are supported:

- `EMAIL_DELIVERY_MODE=log`
  - development-safe mode
  - OTP and recovery emails are logged by the backend
- `EMAIL_DELIVERY_MODE=webhook`
  - production integration mode
  - backend sends a JSON POST to your configured mail service bridge

When using webhook mode, configure:

- `EMAIL_WEBHOOK_URL`
- `EMAIL_WEBHOOK_TOKEN`
- `EMAIL_FROM_ADDRESS`

Webhook payload fields:

- `from`
- `to`
- `subject`
- `text`
- `html`
- `metadata`

This keeps the auth backend provider-agnostic while still making recovery and OTP deployable behind your own mail service.

## Security notes

- access tokens are short-lived
- refresh tokens are hashed in the database and rotated on refresh
- password reset and MFA codes are hashed in the database and expire automatically
- OTP issuance is rate-limited per user and purpose
- user suspension and password reset revoke active refresh sessions
- global request throttling is enabled
- CORS is allowlisted from configured frontend origins only
- security headers are added at the app boundary

## Suggested deployment checklist

- set strong random values for `JWT_SECRET` and `JWT_CHALLENGE_SECRET`
- set `NODE_ENV=production`
- set `FRONTEND_ORIGIN`, `COOKIE_DOMAIN`, and `COOKIE_SAME_SITE`
- configure HTTPS at the edge
- enable `TRUST_PROXY=true` if behind a proxy
- connect `EMAIL_DELIVERY_MODE=webhook` to your mail system
- run `pnpm prisma:generate`, `pnpm db:migrate`, and `pnpm db:seed`
- run `pnpm type:check` and the test suite in CI before deploy
