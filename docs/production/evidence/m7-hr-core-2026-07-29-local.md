# M7 HR verification (2026-07-29, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| Staff self-service own payslips | PASS | HTTP 200 |
| Staff denied admin payslip list | PASS | HTTP 403 |
| HR payroll runs list | PASS | HTTP 200 |
| HR denied payroll approve without approver role | PASS | HTTP 403 |
