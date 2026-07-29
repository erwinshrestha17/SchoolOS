# Staging Gates Evidence (Local Simulation)

- Date: 2026-07-29T12:43:54.755Z
- API base URL: http://localhost:4000/api/v1
- Result: **PASS**

## Gate results

| Gate | Result |
| --- | --- |
| db:validate | PASS |
| smoke:pilot | PASS |
| verify-def-staging | PASS |
| web-e2e-public-smoke | PASS |
| backup:local | PASS |

## Notes

- Requires staging infra from `pnpm staging:deploy:local` and a running API (`pnpm dev` or container profile).
- Full authenticated Playwright suite should be rerun against TLS staging before GA.
- Started: 2026-07-29T12:43:02.643Z
- Finished: 2026-07-29T12:43:54.755Z
