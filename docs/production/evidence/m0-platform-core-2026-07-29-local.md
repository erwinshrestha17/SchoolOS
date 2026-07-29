# M0 Platform Core verification (2026-07-29, local)

Status: **PASS (local development complete; not staging validated)**

Scope: P1-01 `mustChangePassword` guard, P1-03 support-override `/auth/me`, DEF-06 deferred entitlement closure, tenant registration guard chain, suspended-tenant write fail-closed, expanded platform smoke.

| Check | Result | Detail |
|---|---|---|
| `must-change-password.guard.spec` | PASS | 4/4 |
| `entitlement-coverage.contract.spec` | PASS | DEF-06 static gate; service-requests + advanced-operations `@NoModuleEntitlement` |
| `auth.service.spec` getProfile support override | PASS | Effective tenant projection during override |
| `jwt-auth.guard.spec` | PASS | Guard chain includes must-change-password enforcement |
| `m0-*.contract.spec` (5 suites) | PASS | 79/79 |
| `platform-hardening.e2e-spec` M0 slices | PASS | 49/49 incl. DEF-01 register, suspended tenant, P1-01 |
| `pnpm smoke:platform` | PASS | 11/11 (health, tenants, queues, providers/readiness, onboarding, school denial) |
| `pnpm ga:verify:wave0` | PARTIAL | db:validate, openapi, entitlement contract, smoke:pilot PASS; flutter analyze skipped (sandbox) |

## Commands run

```bash
pnpm --filter @schoolos/api test must-change-password.guard.spec entitlement-coverage.contract.spec auth.service.spec jwt-auth.guard.spec
pnpm --filter @schoolos/api test m0-
pnpm --filter @schoolos/api exec tsc --noEmit
pnpm --filter @schoolos/api test:e2e -- platform-hardening.e2e-spec
SMOKE_PILOT_REHEARSAL_TENANT_ID=7de9c32a-16b5-46b9-bb8b-f5dbaa454a0f pnpm smoke:platform
pnpm ga:verify:wave0
```

## Browser E2E (fixture-gated)

```bash
SCHOOLOS_E2E_M0_ACCOUNT_SECURITY_FIXTURES=true pnpm db:seed:e2e:m0-account-security
SCHOOLOS_E2E_M0_PLATFORM_ONBOARD_FIXTURES=true pnpm db:seed:e2e:m0-platform
pnpm --filter @schoolos/web exec playwright test e2e/account-security.spec.ts e2e/m0-platform-onboard.spec.ts e2e/platform-smoke.spec.ts
```

Browser specs require live API + web dev server; not re-run in this evidence capture when fixtures are unseeded.

## Honest posture

- **Development complete** for documented M0 P1 security gaps in this slice.
- **Not claimed:** TLS VPS staging, controlled pilot validated, GA/production release.
