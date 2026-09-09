# M4 Academics verification (2026-09-09, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **FAIL**

| Check | Result | Detail |
|---|---|---|
| M4 admin login | PASS | token received |
| Exam terms list | PASS | HTTP 200 |
| Assessment components list | PASS | HTTP 200 |
| Report export catalog | PASS | HTTP 200 |
| Assigned teacher marks list | PASS | HTTP 200 |
| Teacher unassigned mark write denied | PASS | HTTP 404 |
| M4 parent login | PASS | token received |
| Parent linked-child published report cards | FAIL | HTTP 200, cards=0 |
| Parent unrelated child report cards denied | PASS | HTTP 404 |
