# Pilot Rehearsal Provision Log

- Started: 2026-07-29T12:49:45.602Z
- Finished: 2026-07-29T12:49:48.185Z
- Result: **PASS**

## Commands

```bash
pnpm db:seed:platform
pnpm --filter @schoolos/api db:seed:pilot-rehearsal
```

## Seed output

```
> @schoolos/api@0.0.1 db:seed:pilot-rehearsal /Users/erwin/Projects/SchoolOS/apps/api
> tsx prisma/seed-pilot-rehearsal-tenant.ts

Created pilot rehearsal tenant "pilot-rehearsal-1".

--- Pilot Rehearsal Tenant Ready ---
Tenant ID:   7de9c32a-16b5-46b9-bb8b-f5dbaa454a0f
Slug:        pilot-rehearsal-1
Admin email: admin@pilot-rehearsal.schoolos.test
Admin password (default): PilotRehearsal1!
Set PILOT_REHEARSAL_ADMIN_PASSWORD to override.

Wave 1 modules enabled; wave-gated modules forced OFF via overrides.
Next: complete Day-0 setup at /dashboard/settings/onboarding
```

## Tenant

- Slug: `pilot-rehearsal-1`
- Admin: `admin@pilot-rehearsal.schoolos.test`
- Password: set via `PILOT_REHEARSAL_ADMIN_PASSWORD` or seed default (see stdout once)

## Next steps

1. `pnpm staging:api:local`
2. `pnpm verify:pilot-entitlements`
3. `pnpm smoke:pilot:rehearsal` (after Day-0 academic setup for full persona smoke)

## Verification (2026-07-29)

- `pnpm verify:pilot-entitlements`: **PASS** (8/8)
- `pnpm smoke:pilot:rehearsal`: **PASS** (41/41, Wave 1 mode)
- `pnpm seed:pilot-rehearsal-personas`: **PASS**
- Onboarding API: **79%** (11/14); branding upload pending

## Next steps

1. Upload branding at `/dashboard/settings/school/branding`
2. Optional: `pnpm smoke:pilot:rehearsal` after any structural changes
3. Begin Day-1 operations runbook §5 (Wave 1 steps only)
