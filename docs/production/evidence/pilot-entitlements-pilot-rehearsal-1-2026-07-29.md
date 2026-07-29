# Pilot entitlement verification (2026-07-29)

- Tenant slug: `pilot-rehearsal-1`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| Pilot admin login | PASS | token received |
| Wave1 students list | PASS | HTTP 200 |
| Wave1 notices list | PASS | HTTP 200 |
| Wave1 homework list | PASS | HTTP 200 |
| Wave2 fees denied | PASS | HTTP 403 |
| Wave3 exams denied | PASS | HTTP 403 |
| Wave5 learning denied | PASS | HTTP 403 |
| Wave4 library denied | PASS | HTTP 403 |
