# M5 Activity verification (2026-07-29, local)

- Tenant slug: `pilot-rehearsal-1`
- API: http://localhost:4000/api/v1
- Result: **PASS**

| Check | Result | Detail |
|---|---|---|
| M5 class teacher login | PASS | token received |
| Teacher activity scopes reachable | PASS | HTTP 200, count=1 |
| Teacher activity posts list | PASS | HTTP 200 |
| M5 parent login | PASS | token received |
| Parent linked-child activity feed | PASS | HTTP 200 |
