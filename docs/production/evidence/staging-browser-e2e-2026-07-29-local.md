# Staging Browser E2E Evidence (Local Simulation)

- Date: 2026-07-29
- Environment: local staging (Postgres 5434, Redis 6380, API :4000, Web :3101)
- Result: **PASS** (25 passed, 11 skipped — skipped tests require optional mutation/fixture env flags)

## Stack

```bash
docker compose -f docker-compose.staging.yml -p schoolos-staging up -d postgres redis
pnpm staging:deploy:local
pnpm staging:api:local   # background
```

## E2E command

```bash
cd apps/web && pnpm exec playwright install chromium

SCHOOLOS_E2E_SKIP_WEB_BUILD=true \
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1 \
SCHOOLOS_E2E_PASSWORD=schoolos-local-demo-only \
SCHOOLOS_E2E_EMAIL=admin@schoolos.com \
SCHOOLOS_E2E_TENANT_SLUG=default-school \
DATABASE_URL=postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public \
pnpm test:web:e2e
```

## Specs exercised

- `public-smoke.spec.ts`
- `phase2f-browser-smoke.spec.ts`
- `dashboard-route-audit.spec.ts`
- `phase4-hardening-smoke.spec.ts`
- `account-security.spec.ts` (non-mutating checks)
- `m12-m15-notice-workflows.spec.ts`
- `student-admissions-smoke.spec.ts` (base flows; mutation fixtures skipped)

## Build fix applied

- `notice-approval-decision-panel.tsx`: aligned `ConfirmDialog` props (`isOpen` / `onClose`) for Next.js production build.

## Follow-up

- Re-run on TLS VPS staging host with HTTPS origins before controlled-pilot validated claim.
- Enable optional M1 mutation specs with dedicated fixture env when staging that workflow.
