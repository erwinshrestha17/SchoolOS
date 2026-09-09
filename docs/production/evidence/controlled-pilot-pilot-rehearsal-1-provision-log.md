# Pilot Rehearsal Provision Log

- Started: 2026-09-09T09:42:52.770Z
- Finished: 2026-09-09T09:42:56.190Z
- Result: **PASS**

## Commands

```bash
SCHOOLOS_PILOT_REHEARSAL_FIXTURES=true pnpm --filter @schoolos/api db:seed:pilot-rehearsal
SCHOOLOS_PILOT_REHEARSAL_FIXTURES=true pnpm --filter @schoolos/api db:seed:pilot-rehearsal-personas
```

## Seed output

```
> @schoolos/api@0.0.1 db:seed:pilot-rehearsal /Users/erwin/Projects/SchoolOS/apps/api
> tsx prisma/seed-pilot-rehearsal-tenant.ts

Created pilot rehearsal tenant "pilot-rehearsal-1".

--- Pilot Rehearsal Tenant Ready ---
Tenant ID:   0c8ffe59-4969-43ba-b08a-4a135447b614
Slug:        pilot-rehearsal-1
Admin email: admin@pilot-rehearsal.schoolos.test
Admin credentials: configured for local rehearsal only

Wave 1 modules enabled; wave-gated modules forced OFF via overrides.
Next: complete Day-0 setup at /dashboard/settings/onboarding
> @schoolos/api@0.0.1 db:seed:pilot-rehearsal-personas /Users/erwin/Projects/SchoolOS/apps/api
> tsx prisma/seed-pilot-rehearsal-personas.ts


--- Pilot Rehearsal Personas Ready ---
Tenant: pilot-rehearsal-1
Sections: A, B
Subjects: Nepali, English, Mathematics
Persona credentials: configured for local rehearsal only
Smoke personas: principal, classteacher.1a, subjectteacher.math,
  guardian.c01a001, staff, accountant, driver

Next: pnpm smoke:pilot:rehearsal
```

## Tenant

- Slug: `pilot-rehearsal-1`
- Admin: `admin@pilot-rehearsal.schoolos.test`
- Credentials: local rehearsal only; never copied into evidence

## Next steps

1. `pnpm staging:api:local`
2. `pnpm verify:pilot-entitlements`
3. `pnpm smoke:pilot:rehearsal` (Wave 1 mode)
