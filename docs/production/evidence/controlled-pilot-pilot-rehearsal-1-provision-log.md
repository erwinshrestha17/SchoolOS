# Pilot Rehearsal Provision Log

- Started: 2026-07-29T13:32:48.338Z
- Finished: 2026-07-29T13:32:51.037Z
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

Refreshed pilot rehearsal tenant "pilot-rehearsal-1".

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
2. `pnpm seed:pilot-rehearsal-personas`
3. `pnpm verify:pilot-entitlements`
4. `pnpm smoke:pilot:rehearsal` (Wave 1 mode — after persona seed)
