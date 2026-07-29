# Staging Gates Evidence (Local Simulation)

- Date: 2026-07-29T11:50:00.000Z
- API base URL: http://localhost:4000/api/v1
- Database: schoolos_staging@localhost:5434
- Result: **PARTIAL** (core security/readiness passed; smoke/e2e need fixture follow-up)

## Gate results

| Gate | Result | Notes |
| --- | --- | --- |
| staging:deploy:local | PASS | Migrations + seed on isolated staging DB |
| verify-def-staging | PASS | DEF-01 deny, /ready 200, DEF-06 assignments |
| smoke:pilot | PARTIAL | 6 failures on fresh staging seed (parent/teacher fixtures) |
| web-e2e public-smoke | PARTIAL | Requires web dev server; 4 failures without `pnpm dev` for web |
| backup:local (staging DB) | PASS | See staging-backup evidence |
| readiness.spec.ts | PASS | 503 when degraded, 200 when healthy |

## Commands

```bash
pnpm staging:deploy:local
node scripts/start-staging-api-local.mjs
pnpm smoke:pilot
node scripts/verify-def-staging.mjs
pnpm --filter @schoolos/api test -- readiness.spec.ts
DATABASE_URL=postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public pnpm backup:local
```

## Follow-up before GA

- Rerun `pnpm smoke:pilot` after aligning staging seed credentials/fixtures
- Run authenticated Playwright suite with web + API running on TLS staging host
- Execute `pnpm verify:env:staging` on VPS with HTTPS origins
