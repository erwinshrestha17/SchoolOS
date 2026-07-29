# M15 Notices verification (2026-07-29, local)

- Tenant slug: `pilot-rehearsal-1`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| M15 admin login | PASS | token received |
| M15 parent login | PASS | token received |
| Admin creates required-acknowledgement notice | PASS | HTTP 201 |
| Parent receives M12 delivery for published notice | PASS | delivery found |
| Delivery exposes pending acknowledgement state | PASS | pending ack |
| Parent acknowledgement idempotent path reachable | PASS | HTTP 201 |
| Acknowledgement replay returns same record | PASS | same id |
| Admin notices queue reachable | PASS | HTTP 200 |
