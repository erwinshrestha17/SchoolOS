# M1 Admissions verification (2026-07-31, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **FAIL**

| Check | Result | Detail |
|---|---|---|
| M1 admin login | PASS | token received |
| Students list | PASS | HTTP 200 |
| Admission cases queue | PASS | HTTP 200 |
| Admission policies list | PASS | HTTP 200 |
| QR credential summary | PASS | HTTP 200 |
| Document requests queue | PASS | HTTP 200 |
| Admission import CSV template | PASS | HTTP 200, csv=ok |
| M1 parent login | PASS | token received |
| Parent linked children | PASS | HTTP 200, count=1 |
| Parent linked child profile | PASS | HTTP 200 |
| Parent denied unrelated child profile | FAIL | HTTP 404 |
| Alternate parent notifications reachable | PASS | HTTP 200 |
