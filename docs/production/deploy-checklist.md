# SchoolOS Deploy Checklist

Use this checklist for every staging or production deployment.

## 1) Scope and branch hygiene

- Confirm deployment branch and commit SHA are finalized.
- Ensure no unrelated local changes are included.
- Confirm rollback commit/image is recorded before deployment.

## 2) Environment preflight

- For production deploys, export required environment values:
  - `ALLOW_PROD_BOOT=true`
  - `DATABASE_URL`
  - `REDIS_HOST` and `REDIS_PORT`
  - `JWT_SECRET` and `JWT_CHALLENGE_SECRET` (32+ chars)
  - `MEDICAL_ENCRYPTION_KEY` (32+ chars)
  - `FRONTEND_ORIGIN` or `FRONTEND_ORIGINS` (https origins only)
- If using webhook email mode, set:
  - `EMAIL_WEBHOOK_URL`
  - `EMAIL_WEBHOOK_TOKEN`
- If using R2 storage, set:
  - `R2_BUCKET`
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_REGION` (defaults to `auto`)
  - `R2_PUBLIC_BASE_URL`

## 3) Canonical verification command

Run one command from repo root:

```bash
pnpm verify:deploy
```

What it covers:

- deploy env preflight
- tracked artifact guard
- Prisma generate/validate
- OpenAPI gate
- lint, typecheck, unit tests
- API e2e
- web smoke e2e
- build

## 4) CI behavior

- CI always runs `pnpm verify:deploy:core`.
- CI runs web smoke e2e only when web-impacting files changed.
- If web smoke is skipped in CI but deployment affects UI runtime behavior, run `pnpm test:web:e2e` manually before go-live.

## 5) Database and migration

- Take a backup before `pnpm db:migrate`.
- Validate API readiness after migration (`/api/v1/health`, `/api/v1/ready`).
- Confirm rollback procedure owner and command are documented.

## 6) Go/No-go

Go only if all items are true:

- `pnpm verify:deploy` passed.
- Migration and readiness checks passed.
- Backup and rollback path verified.
- No critical unresolved incidents.
