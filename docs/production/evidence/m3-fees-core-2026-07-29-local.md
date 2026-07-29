# M3 Fees verification (2026-07-29, local)

- Tenant slug: `default-school`
- API: http://localhost:4002/api/v1
- Mock gateway: http://127.0.0.1:4010
- Result: **FAIL**
- Boundary: local generic_json_v1 + HMAC webhook proof only; production eSewa/Khalti TLS sandbox remains an ops track.

| Check | Result | Detail |
|---|---|---|
| M3 accountant login | PASS | token received |
| Fees dashboard summary | PASS | HTTP 200 |
| Invoice list | PASS | HTTP 200 |
| Idempotent cash collection probe | FAIL | first HTTP 500, replay HTTP 500, paymentId=missing |
| Receipt list | PASS | HTTP 200 |
| Cashier-close preview | PASS | HTTP 200 |
| M3 parent login | PASS | token received |
| Parent linked-child fee summary | PASS | HTTP 200 |
| Parent unrelated child fee summary denied | PASS | HTTP 404 |
| Parent payment gateway readiness (sandbox) | PASS | HTTP 200, sandbox=true |
| Parent sandbox fee payment idempotent | PASS | first HTTP 201, replay HTTP 201, invoice=FEE-BREAKDOWN-SHRAWAN |
| Module gate — teacher denied fees invoices | PASS | HTTP 403 |
| Online gateway readiness | PASS | HTTP 200, enabled=true, status=ready |
| Online payment initiate | PASS | HTTP 201, status=READY (restart staging API after build if provider URL blocked) |
| Online webhook settlement idempotent | FAIL | first HTTP 409, replay HTTP 409 |
