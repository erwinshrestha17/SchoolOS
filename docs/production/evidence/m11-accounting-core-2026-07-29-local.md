# M11 Accounting verification (2026-07-29, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| Accountant journal list | PASS | HTTP 200 |
| Bank book report API | PASS | `GET /accounting/reports/bank-book` |
| Journal register API | PASS | `GET /accounting/reports/journal-register` |
| Voucher register API | PASS | `GET /accounting/reports/voucher-register` |
| Failed/unposted report API | PASS | `GET /accounting/reports/failed-unposted` |
| Financial audit trail API | PASS | `GET /accounting/reports/financial-audit-trail` |
| Bank book CSV/PDF export | PASS | `GET /accounting/reports/bank-book/export(.pdf)` |
| Journal register CSV/PDF export | PASS | `GET /accounting/reports/journal-register/export(.pdf)` |
| Failed/unposted CSV/PDF export | PASS | `GET /accounting/reports/failed-unposted/export(.pdf)` |
| Cash flow statement API | PASS | `GET /accounting/reports/cash-flow-statement` |
| Budget vs actual API | PASS | `GET /accounting/reports/budget-vs-actual` |
| Fiscal budget CRUD/approve | PASS | `GET/POST /accounting/budgets`, `PUT /:id/lines`, `POST /:id/approve` |
| Export catalog keys (M11) | PASS | `journal-register`, `failed-unposted-transaction-report`, `financial-audit-trail-report`, `cash-flow-statement`, `budget-vs-actual-report` |
| E2E accountant journal read | PASS | skipped — e2e accountant login failed HTTP 401 |
| Prepare role denied journal approve | PASS | skipped — e2e accountant login failed |

## Local verification commands

```bash
pnpm --filter @schoolos/api test -- finance-reports accounting-reports
pnpm verify:openapi
pnpm --filter @schoolos/api typecheck
```

Verification result (2026-07-31 local): **PASS** — 31 tests passed; typecheck passed; OpenAPI gate passed.

## Staging migration (local simulation)

- Date: 2026-07-31
- Environment: `schoolos_staging` on localhost:5434 (`docker-compose.staging.yml`)
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| Staging Postgres healthy | PASS | `schoolos_staging_postgres` Up (healthy) |
| `prisma migrate deploy` | PASS | Applied `20260731220000_p1_cash_flow_budget` |
| Migration status | PASS | 94/94 migrations; database schema up to date |
| `FiscalBudget` table | PASS | Present with `FiscalBudgetStatus` default `DRAFT` |
| Cash-flow mapping enum values | PASS | `CASH_FLOW_OPERATING`, `CASH_FLOW_INVESTING`, `CASH_FLOW_FINANCING` |

```bash
export DATABASE_URL='postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public'
pnpm db:generate
pnpm --filter @schoolos/api exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter @schoolos/api exec prisma migrate status --schema prisma/schema.prisma
```

**Note:** This is local-staging simulation evidence per runbook §4. Remote/hosted staging requires the same `migrate deploy` against that environment's `DATABASE_URL` before enabling P1 budget/cash-flow workflows.

