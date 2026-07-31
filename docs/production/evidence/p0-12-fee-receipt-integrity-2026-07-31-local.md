# P0-12 Fee and Receipt Integrity (2026-07-31, local)

Status: **PARTIAL**

Scope: Close the deferred P0 audit item where `pnpm verify:m3-fees` failed **Idempotent cash collection probe** because invoice `c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c02` (`M3-E2E-COLLECT-INV-01`) was missing unless the dedicated M3 collection fixture is seeded. Re-run full local M3 HTTP verify with required fixtures and mock gateway.

**Honest boundary:** Local development / Internal QA evidence only. Not staging validated, not controlled-pilot validated, not production eSewa/Khalti TLS reconciliation (see Wave 2 ops track in `SCHOOLOS_GA_PROGRAM_TRACKER.md`).

## Root cause (prior FAIL)

- Verify script hardcodes collection invoice id `c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c02`.
- That row is created only by `apps/api/prisma/seed-m3-collection-e2e.ts` when `SCHOOLOS_E2E_M3_COLLECTION_FIXTURES=true`.
- Without the seed, collection POST returned HTTP 500 and paymentId missing (fixture/ops gap, not a collection-idempotency regression).

## Environment

| Component | Value |
|---|---|
| PostgreSQL | `docker` container `schoolos_postgres`, port `5433`, DB `schoolos_db` |
| Redis | `schoolos_redis` (running) |
| API | `http://localhost:4000/api/v1` (health HTTP 200) |
| Mock gateway | `http://127.0.0.1:4010` (started via `node scripts/mock-payment-gateway-local.mjs`) |
| Tenant | `default-school` (`Tenant.isActive = true`) |

## Fixture seed commands (executed)

```bash
# Dedicated collection invoice (required for cash idempotency probe)
SCHOOLOS_E2E_M3_COLLECTION_FIXTURES=true pnpm db:seed:e2e:m3-collection

# Online payment intent invoice + NEPAL_GATEWAY provider config
SCHOOLOS_E2E_M3_PAYMENT_GATEWAY_FIXTURES=true pnpm db:seed:e2e:m3-payment-gateway

# Parent multi-line bills (FEE-BREAKDOWN-BHADRA etc.) — no root package.json alias yet
cd apps/api && SCHOOLOS_PARENT_FEE_FIXTURES=true pnpm exec tsx prisma/seed-parent-fee-breakdown.ts
```

Collection seed output (representative): `Sanjana Collection E2E, invoice M3-E2E-COLLECT-INV-01 (NPR 1000, unpaid)`.

Parent fee seed output: three itemised bills for guardian `guardian.c01b006@schoolos.test`, including `FEE-BREAKDOWN-BHADRA` (ISSUED, unpaid).

## Canonical verify command

```bash
pnpm verify:m3-fees
# → node scripts/verify-m3-fees-local.mjs
```

### What the verify script exercises

- Accountant auth; fees dashboard summary; paginated invoices/receipts; cashier-close preview.
- **Cash collection idempotency:** POST `/payments` twice with same `idempotencyKey` against fixture invoice `c2f4a8e1-…9c02`.
- Parent persona: linked-child fee summary; unrelated child denied; sandbox gateway readiness; sandbox fee payment idempotency.
- RBAC module gate: class teacher denied `/fees/invoices`.
- Optional online path (mock gateway): gateway readiness, initiate, HMAC webhook settlement idempotency.

## Verify results (2026-07-31)

Exit code: **1** (script treats any FAIL check as overall FAIL).

Auto-generated checklist: `docs/production/evidence/m3-fees-core-2026-07-31-local.md`.

| Check | Result | Notes |
|---|---|---|
| Idempotent cash collection probe | **PASS** | first/replay HTTP 201, same `paymentId` — **primary P0-12 deferred item closed** |
| Receipt list | PASS | HTTP 200 |
| Cashier-close preview | PASS | HTTP 200 |
| Parent linked-child fee summary | PASS | HTTP 200 |
| Parent unrelated child fee summary denied | PASS | HTTP 404 |
| Module gate — teacher denied fees invoices | PASS | HTTP 403 |
| Parent sandbox fee payment idempotent | **FAIL** | Verify uses first linked child from `/mobile/me/students` (Dilip Dangol); itemised bills seeded on guardian’s first DB link (Sunita Bhattarai). Fee summary for probed child has empty `recentInvoices`. |
| Online webhook settlement idempotent | **FAIL** | POST `/payments/online/webhook/nepal_gateway` HTTP 500 (initiate READY succeeds; HMAC signature accepted path reaches server error during settlement — needs backend log / accounting posting investigation) |
| Online initiate + gateway readiness | PASS | With mock gateway running |

### Supplementary unit evidence

```bash
pnpm --filter @schoolos/api exec jest src/finance/finance.service.spec.ts \
  -t "idempotent collection" --runInBand
```

Result: **PASS** (1/1).

## P0-12 assessment

| Gate | Local status |
|---|---|
| Manual cash collection + receipt idempotency (tenant-scoped fixture) | **PASS** (with collection seed) |
| Receipt listing / cashier-close read paths | **PASS** |
| Parent fee scope (linked vs unrelated child) | **PASS** |
| Full `verify:m3-fees` green | **FAIL** (parent sandbox child selection + webhook settlement) |
| Production digital payment reconciliation | **Not attempted** |

## Remaining blockers for full P0-12 / Wave 2 close

1. **Ops:** Document or add `pnpm` alias for `SCHOOLOS_PARENT_FEE_FIXTURES=true` parent fee seed; align verify script child selection with payable fixture (or document required env ordering).
2. **Backend:** Diagnose online webhook HTTP 500 on local settlement (likely ledger/posting path in `handleOnlinePaymentWebhook`).
3. **Ops:** Staging re-run of `verify:m3-fees` with collection + gateway (+ parent fee) seeds and mock gateway or approved sandbox.
4. **Ops:** Real provider TLS sandbox reconciliation (P1-15 / Wave 2 tracker) — out of scope for this local batch.

## Code fixes in this session

None committed. The collection probe failure was resolved by running the documented fixture seed, not by application code changes.

## Do not claim

- Staging validated, controlled-pilot validated, release candidate, GA, or production eSewa/Khalti proof.
- Full P0-12 closed while `verify:m3-fees` exits non-zero.
