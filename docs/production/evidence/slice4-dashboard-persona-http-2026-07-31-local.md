# Slice 4 Dashboard Persona HTTP Evidence (2026-07-31, local)

- Tenant slug: `default-school`
- API base: `http://localhost:4000/api/v1`
- Result: **PASS** (33/33 checks)

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| API health | PASS | HTTP 200 |
| OpenAPI docs-json reachable | PASS | http://localhost:4000/api/v1/docs-json |
| OpenAPI: general persona absent from schema | PASS | no general enum value |
| OpenAPI: supported persona values present | PASS | admin=true principal=true hr=true accountant=true |
| OpenAPI: no persona query param on dashboard summary | PASS | no persona query param |
| Admin: login | PASS | admin@schoolos.com |
| Admin: HTTP status | PASS | HTTP 200 (expected 200) |
| Admin: compositionPersona | PASS | got admin (expected admin) |
| Admin: no unauthorized module keys | PASS | keys: m1_students, m2_attendance, m3_fees, m10_communications, m6_homework_timetable, m7_hr_payroll |
| Admin: excluded modules absent | PASS | ok |
| Admin: forbidden top-level fields absent | PASS | ok |
| Principal: login | PASS | principal@schoolos.com |
| Principal: HTTP status | PASS | HTTP 200 (expected 200) |
| Principal: compositionPersona | PASS | got principal (expected principal) |
| Principal: no unauthorized module keys | PASS | keys: m10_communications, m2_attendance, m4_academics, m3_fees, m7_hr_payroll |
| Principal: excluded modules absent | PASS | ok |
| Principal: forbidden top-level fields absent | PASS | ok |
| HR: login | PASS | hr@schoolos.com |
| HR: HTTP status | PASS | HTTP 200 (expected 200) |
| HR: compositionPersona | PASS | got hr (expected hr) |
| HR: no unauthorized module keys | PASS | keys: m7_hr_payroll, m10_communications |
| HR: excluded modules absent | PASS | ok |
| HR: forbidden top-level fields absent | PASS | ok |
| Accountant: login | PASS | accountant@schoolos.com |
| Accountant: HTTP status | PASS | HTTP 200 (expected 200) |
| Accountant: compositionPersona | PASS | got accountant (expected accountant) |
| Accountant: no unauthorized module keys | PASS | keys: m3_fees, m9_accounting, m7_hr_payroll |
| Accountant: excluded modules absent | PASS | ok |
| Accountant: forbidden top-level fields absent | PASS | ok |
| Teacher: login | PASS | classteacher@schoolos.com |
| Teacher: HTTP status | PASS | HTTP 403 (expected 403) |
| Driver (route guard — not in dashboard @Roles): login | PASS | driver@schoolos.com |
| Driver (route guard — not in dashboard @Roles): HTTP status | PASS | HTTP 403 (expected 403) |

## Notes

- Run against staging-equivalent API with `default-school` seed for full persona matrix.
- Teacher and unsupported operators must return HTTP 403 with no compositionPersona payload.
