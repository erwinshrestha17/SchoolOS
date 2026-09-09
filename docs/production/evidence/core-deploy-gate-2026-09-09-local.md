# Core Deploy Gate Evidence (Local)

- Date: 2026-09-09
- Environment: local verification with `NODE_ENV` and `DEPLOY_ENV` unset
- Result: **PASS**

## Command

```bash
env -u NODE_ENV -u DEPLOY_ENV pnpm verify:deploy:core
```

## Verified scope

- Generated artifacts, tracked-artifact checks, Prisma generation and schema validation
- OpenAPI contract gate, lint, and TypeScript checks
- API unit suites: 2,965 tests passed
- Web unit suites: 656 tests passed
- API E2E suites: 287 tests passed
- API production build passed
- Web production build passed and generated 261 routes

## Evidence boundary

This is repository-local build and test evidence. It is not TLS staging, provider-sandbox, controlled-pilot, release-candidate, or GA evidence.
