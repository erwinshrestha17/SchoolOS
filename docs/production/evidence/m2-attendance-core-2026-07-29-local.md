# M2 Attendance verification (2026-07-29, local)

- Tenant slug: `pilot-rehearsal-1`
- API: http://localhost:4000/api/v1
- Result: **PASS**

## Wave 1 slice additions (2026-07-29)

- **Homeroom-only mark UX (DEF-02 alignment)**: web mark picker and `listTeacherMobileClassSections` filter to `CLASS_TEACHER` assignments only; read-only register paths unchanged. Unit tests updated in `attendance.service.spec.ts`.
- **Browser E2E**: gated `attendance-fees-smoke.spec.ts` with `SCHOOLOS_E2E_M2_OFFLINE_MUTATIONS=true` not re-run this slice (default-school admin credentials; pilot-rehearsal fixture path deferred).

| Check | Result | Detail |
|---|---|---|
| M2 class teacher login | PASS | token received |
| Homeroom class list | PASS | HTTP 200, count=1 |
| Homeroom today board | PASS | HTTP 200 |
| Homeroom roster read | PASS | HTTP 200 |
| Homeroom sync write not denied | PASS | HTTP 201 |
| Subject teacher denied mobile attendance route | PASS | HTTP 403 (role gate; DEF-02 negative path covered by unit/e2e) |
| M2 parent login | PASS | token received |
| Parent linked-child attendance summary | PASS | HTTP 200 |
| Parent unrelated child attendance denied | PASS | HTTP 403 |
| DEF-04 class teacher provisioned on section | PASS | section=A |
| Admin monthly register reachable | PASS | HTTP 200 |
