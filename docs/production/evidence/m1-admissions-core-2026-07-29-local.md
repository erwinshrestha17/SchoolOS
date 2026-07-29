# M1 Admissions verification (2026-07-29, local)

- Tenant slug: `default-school`
- API: http://localhost:4000/api/v1
- Result: **PASS**

## Wave 1 slice additions (2026-07-29)

- **P1-05**: partial unique index migration `20260729180000_student_guardian_single_primary_active` on `(tenantId, studentId) WHERE isPrimary = true AND status = 'ACTIVE'`; service test covers primary promotion clearing.
- **CSV template**: `GET /admissions/bulk-import/template` returns canonical headers; web download in iEMIS Import & Export panel; `admissions.utils.spec` covers header row.
- **Browser E2E**: gated M1 mutation specs (`SCHOOLOS_E2E_M1_*`) not re-run this slice (dedicated fixtures not seeded).

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
| Parent denied unrelated child profile | PASS | HTTP 403 |
| Alternate parent notifications reachable | PASS | HTTP 200 |
