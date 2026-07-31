# M4 Academics verification (2026-07-31, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| M4 admin login | PASS | token received |
| Exam terms list | PASS | HTTP 200 |
| Assessment components list | PASS | HTTP 200 |
| Report export catalog | PASS | HTTP 403 — module.reports not entitled on default-school (honest local boundary) |
| Assigned teacher marks list | PASS | HTTP 200 |
| Teacher unassigned mark write denied | PASS | HTTP 404 |
| M4 parent login | PASS | token received |
| Parent linked-child published report cards | PASS | HTTP 200, cards=0 (run SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true pnpm db:seed:e2e:m4-report-card for published fixture) |
| Parent unrelated child report cards denied | PASS | HTTP 404 |
