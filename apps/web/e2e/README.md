# Web browser smoke tests

Browser smoke coverage verifies public routes, authenticated school-admin navigation, optional platform checks, and role/persona boundaries for real SchoolOS workflows.

The Playwright config is available at `apps/web/playwright.config.ts`.

Web and mobile persona boundaries are defined by the PRD, SRS, root/app `AGENTS.md` files, and backend authorization contracts.

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

Account & Security password-change smoke uses the school admin credentials for
non-mutating checks. The full reset/force-change/success flow mutates a
dedicated test account only when these values are supplied:

```bash
SCHOOLOS_E2E_PASSWORD_TEST_EMAIL=<dedicated-test-user-email> \
SCHOOLOS_E2E_PASSWORD_TEST_TEMP=<temporary-password> \
SCHOOLOS_E2E_PASSWORD_TEST_FINAL=<final-password> \
pnpm test:web:e2e
```

The state-changing M1 QR lifecycle smoke is disabled by default. Run it only
against a dedicated seeded student whose credential may be rotated, revoked,
and regenerated during the test:

```bash
SCHOOLOS_E2E_M1_MUTATIONS=true \
SCHOOLOS_E2E_M1_QR_STUDENT_SEARCH=<exact-seeded-student-name> \
pnpm --filter @schoolos/web exec playwright test e2e/student-admissions-smoke.spec.ts
```

The workflow restores an active QR credential before it finishes. It still
retains the rotation and revocation history as required audit evidence.

The M1 missing-document reminder smoke uses two dedicated, idempotently seeded
admission cases. Seed only those fixtures, then run the authenticated workflow:

```bash
SCHOOLOS_E2E_M1_REMINDER_FIXTURES=true \
pnpm db:seed:e2e:m1-reminders

SCHOOLOS_E2E_M1_MUTATIONS=true \
SCHOOLOS_E2E_M1_REMINDER_FIXTURES=true \
pnpm --filter @schoolos/web exec playwright test e2e/student-admissions-smoke.spec.ts
```

The browser test selects one case with a guardian phone and one without. It
confirms the backend-authoritative queued, already-queued, or
delivery-unavailable result plus the safe no-phone skip; no browser-derived
delivery state is accepted. A provider-disabled local environment therefore
passes only when the server reports that honest unavailable state.

The M1 waitlist promotion smoke uses one dedicated, idempotently seeded case
with a pinned review policy and an available seat. The policy is kept out of
normal policy resolution, and the seed restores the case to `WAITLISTED` so
the state-changing browser flow is repeatable:

```bash
SCHOOLOS_E2E_M1_WAITLIST_FIXTURES=true \
pnpm db:seed:e2e:m1-waitlist

SCHOOLOS_E2E_M1_MUTATIONS=true \
SCHOOLOS_E2E_M1_WAITLIST_FIXTURES=true \
pnpm --filter @schoolos/web exec playwright test e2e/student-admissions-smoke.spec.ts
```

The browser test opens the Waitlisted queue, confirms the backend-owned live
capacity state, approves the return-to-review action, and verifies that the
case leaves the waitlist. The backend rechecks capacity and records the status
transition in the audit log; the browser does not calculate seat truth.

The M1 admission CSV smoke is an explicit state-changing check. It discovers
the signed-in tenant's current academic year and Class 5 (or the first
available class), creates a uniquely named admission through the real
validation-and-confirmation workflow, and verifies the new student in the
server-backed directory. It does not delete school records, so use it only in
the dedicated local/E2E tenant:

```bash
SCHOOLOS_E2E_M1_MUTATIONS=true \
SCHOOLOS_E2E_M1_BULK_IMPORT=true \
pnpm --filter @schoolos/web exec playwright test \
  e2e/student-admissions-smoke.spec.ts \
  --grep "validates and creates a tenant-scoped admission from CSV"
```

The M1 assessment/interview smoke uses two dedicated, idempotently seeded
admission cases pinned to a policy that requires an interview: one unscheduled
case for the scheduling workflow, and one with a session already scheduled in
the past for the result-recording workflow. Seed the fixtures, then run the
authenticated workflow:

```bash
SCHOOLOS_E2E_M1_ASSESSMENT_FIXTURES=true \
pnpm db:seed:e2e:m1-assessment

SCHOOLOS_E2E_M1_MUTATIONS=true \
SCHOOLOS_E2E_M1_ASSESSMENT_FIXTURES=true \
pnpm --filter @schoolos/web exec playwright test e2e/student-admissions-smoke.spec.ts \
  --grep "assessment"
```

The scheduling test picks the dedicated candidate from the assessment
workspace, schedules it for a few minutes in the future, confirms it drops out
of the "needs scheduling" list, and confirms the persisted session via the
real API. The result test opens the dedicated past-due session in the
Awaiting Results tab, records a passing result with a score, and confirms the
row updates from "Pending" to the recorded result — no browser-derived
capacity, eligibility, or result truth is accepted.

The M2 attendance offline draft and reconnect smoke is a genuine browser-level
network test: it marks a student while the browser context is truly offline
(`context.setOffline(true)`), confirms the draft is saved only in IndexedDB
(no server sync banner appears), then goes back online and confirms the
browser's native `online` event automatically replays the draft to the server
without any manual action. Requires a seeded class teacher with an assigned
section:

```bash
SCHOOLOS_E2E_TENANT_SLUG=<tenant-slug> \
SCHOOLOS_E2E_M2_TEACHER_EMAIL=<seeded-class-teacher-email> \
SCHOOLOS_E2E_M2_TEACHER_PASSWORD=<seeded-class-teacher-password> \
SCHOOLOS_E2E_M2_OFFLINE_MUTATIONS=true \
pnpm --filter @schoolos/web exec playwright test e2e/attendance-fees-smoke.spec.ts \
  --grep "offline"
```

The M3 fees collection smoke is a genuine state-changing money workflow: it
collects a partial payment against a dedicated fixture invoice, verifies the
resulting balance through the real API (never browser-derived), reloads the
page to confirm the remaining balance is served fresh (not client-cached),
then collects the remainder and confirms the invoice reaches `PAID`. Requires
a seeded accountant:

```bash
SCHOOLOS_E2E_M3_COLLECTION_FIXTURES=true \
pnpm db:seed:e2e:m3-collection

SCHOOLOS_E2E_TENANT_SLUG=<tenant-slug> \
SCHOOLOS_E2E_M3_ACCOUNTANT_EMAIL=<seeded-accountant-email> \
SCHOOLOS_E2E_M3_ACCOUNTANT_PASSWORD=<seeded-accountant-password> \
SCHOOLOS_E2E_M3_COLLECTION_MUTATIONS=true \
pnpm --filter @schoolos/web exec playwright test e2e/attendance-fees-smoke.spec.ts \
  --grep "collects a partial payment"
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
