# SchoolOS GA Program Tracker

**Current owner posture (2026-08-25):** active P0 is M0–M7, M11, M12, and M15. M8–M10 are deferred compatibility-only, M13 is frozen and disabled by default, and M14 is roadmap-only.
**First production target:** one real school (Wave 1).
**Honest release stage:** Local staging validated (smoke + authenticated browser E2E); **not** TLS VPS staging; **not** controlled-pilot validated; **not** GA.

Canonical plan: `.cursor/plans/schoolos_full_ga_program_9f539c81.plan.md` (do not edit from implementation PRs; update this tracker instead).

## Wave status

| Wave | Goal                                    | Implementation                                              | Local verification                                                     | Ops evidence                                                                            |
| ---- | --------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0    | P0 cross-cutting, doc sync, staging ops | Complete                                                    | PASS (`ga:verify:wave0`, `smoke:pilot`, browser E2E)                   | TLS VPS staging pending                                                                 |
| 1    | Core modules for school #1              | Complete                                                    | PASS (`ga:verify:wave1`, flutter 539 tests)                            | Controlled pilot + device QA pending                                                    |
| 2    | M3 full fees + digital payments         | verify:m3-fees + mock gateway + collection seed             | Local HTTP verify (`verify:m3-fees`, `ga:verify:wave2`)                | Production eSewa/Khalti TLS sandbox pending                                             |
| 3    | M4 exams/report cards/promotion         | verify:m4-academics + deterministic report-card/marks seeds | PASS (`verify:m4-academics`, 15-test browser suite, `ga:verify:wave3`) | TLS staging rerun pending                                                               |
| 4    | Active M7/M11 plus M8–M10 compatibility | HTTP slices + deterministic role-boundary seed              | PASS (`ga:verify:wave4`, 5-test browser suite)                         | M7 Nepal CA sign-off external                                                           |
| 5    | M13 Learning                            | Preserved behind route/entitlement guards                   | Frozen; disabled by default; excluded from current pilot acceptance    | Future reactivation requires explicit owner decision, security review, and device proof |
| 6    | Multi-school self-serve + GA sign-off   | Transactional tenant register                               | PASS (`ga:verify:wave6`)                                               | Load test + owner sign-off pending                                                      |

## Wave 0 checklist

- [x] Doc sync, P0 cross-cutting, entitlement/CLS, smoke fixture scripts
- [x] `pnpm smoke:pilot` green on local staging (5434/6380/4000)
- [x] M0 Platform Core local verification slice — see `m0-platform-core-2026-07-29-local.md` (mustChangePassword guard, support override profile, DEF-06 closure, expanded `smoke:platform`)
- [x] M1 Admissions local verification slice — see `m1-admissions-core-2026-07-29-local.md` (P1-04 inbox fail-closed, P1-05 primary guardian index, CSV template, `verify:m1-admissions`)
- [x] M2 Attendance local verification slice — see `m2-attendance-core-2026-07-29-local.md` (DEF-02/DEF-04 HTTP proof, homeroom-only mark UX, `verify:m2-attendance`)
- [x] M15+M12 notices local verification slice — see `m15-notices-core-2026-07-29-local.md` (`verify:m15-notices`, M12 delivery + ack)
- [x] M6 homework local verification slice — see `m6-homework-core-2026-07-29-local.md` (`verify:m6-homework`)
- [x] M5 activity local verification slice — see `m5-activity-core-2026-07-29-local.md` (`verify:m5-activity`)

## Wave 1 checklist

- [x] M15 notice approval write UI + decision panel
- [x] Wave 1 onboarding checklist (class teachers, teacher assignments, school-plane links)
- [x] Settings nav → Day-1 onboarding (`/dashboard/settings/onboarding`)
- [x] M5 mobile media consent submit guard
- [x] Teacher-assignment scope uniqueness is null-safe at the database layer — see `p1-19-teacher-assignment-null-safe-uniqueness-2026-09-09-local.md`
- [x] Flutter analyze + 539 unit/widget tests
- [x] Local controlled-pilot rehearsal provisioned, forced-password-change verified, Wave-1 entitlements verified, and persona smoke passed — see `controlled-pilot-pilot-rehearsal-1-provision-log.md`, `pilot-entitlements-pilot-rehearsal-1-2026-09-09.md`, and `controlled-pilot-rehearsal-smoke-2026-09-09-local.md`
- [ ] Controlled pilot on production school #1 with owner sign-off
- [ ] Mobile device QA (emulator + physical) — see `mobile-qa-2026-07-29-local.md`
- [ ] M12 provider sandbox staging proof on TLS host

## Wave 2 checklist

- [x] `verify:m3-fees` — manual collection, receipts, parent scope, module gate, parent sandbox
- [x] Local mock payment gateway (`mock-payment-gateway-local.mjs`) + `db:seed:e2e:m3-payment-gateway`
- [x] Online path — gateway readiness, initiate, HMAC webhook idempotency (local generic_json_v1 only)
- [x] Playwright `reuseExistingServer` when `PLAYWRIGHT_BASE_URL` set
- [x] `ga:verify:wave2` wires HTTP verify + optional fees browser E2E
- [ ] Production/TLS eSewa/Khalti/Connect IPS sandbox credentials and reconciliation sign-off

## Wave 3 checklist

- [x] `verify:m4-academics` — exam terms, components, report catalog, teacher marks, parent report cards
- [x] `ga:verify:wave3` wires HTTP verify + optional academics browser E2E
- [x] Local-staging browser E2E with deterministic report-card and marks fixtures, including assignment-scoped CAS pickers — 15/15 passed; see `ga-wave3-2026-09-09T10-05-33-575Z-local.md`
- [ ] Repeat authenticated M4 browser E2E on the provisioned TLS staging host

## Wave 4 checklist

- [x] `verify:m7-hr`, `verify:m8-library`, `verify:m9-transport`, `verify:m10-canteen`, `verify:m11-accounting`
- [x] `ga:verify:wave4` HTTP slices + deterministic M7/M11 role-boundary browser E2E — 5/5 passed; see `ga-wave4-2026-09-09T09-11-26-852Z-local.md`
- [ ] M7 Nepal statutory payroll CA external sign-off

## Wave 2–6 code highlights

| Wave | Deliverable                                                                | Status                                                       |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2    | `verify:m3-fees`, mock gateway, parent sandbox, online webhook idempotency | Implemented                                                  |
| 3    | `verify:m4-academics` + report-card fixture seed                           | Implemented                                                  |
| 4    | Active M7/M11 verification plus preserved M8–M10 compatibility checks      | Implemented and locally verified                             |
| 5    | Frozen M13 route/entitlement boundary                                      | Preserved; production enablement excluded from current scope |
| 6    | Transactional tenant register + duplicate admin email check                | Implemented                                                  |

## Evidence index

| Artifact                                                    | Path                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| GA Wave 0–6 verification                                    | `docs/production/evidence/ga-wave{0-6}-2026-07-29-local.md`                                  |
| Staging browser E2E                                         | `docs/production/evidence/staging-browser-e2e-2026-07-29-local.md`                           |
| Controlled pilot rehearsal                                  | `docs/production/evidence/controlled-pilot-pilot-rehearsal-1-2026-07-29.md`                  |
| Current pilot rehearsal provision                           | `docs/production/evidence/controlled-pilot-pilot-rehearsal-1-provision-log.md`               |
| Current pilot entitlement boundary                          | `docs/production/evidence/pilot-entitlements-pilot-rehearsal-1-2026-09-09.md`                |
| Current pilot persona smoke                                 | `docs/production/evidence/controlled-pilot-rehearsal-smoke-2026-09-09-local.md`              |
| M0 platform core (local)                                    | `docs/production/evidence/m0-platform-core-2026-07-29-local.md`                              |
| M1 admissions core (local)                                  | `docs/production/evidence/m1-admissions-core-2026-07-29-local.md`                            |
| M2 attendance core (local)                                  | `docs/production/evidence/m2-attendance-core-2026-07-29-local.md`                            |
| M15 notices core (local)                                    | `docs/production/evidence/m15-notices-core-2026-07-29-local.md`                              |
| M6 homework core (local)                                    | `docs/production/evidence/m6-homework-core-2026-07-29-local.md`                              |
| M5 activity core (local)                                    | `docs/production/evidence/m5-activity-core-2026-07-29-local.md`                              |
| M3 fees core (local)                                        | `docs/production/evidence/m3-fees-core-2026-07-29-local.md`                                  |
| M4 academics core (local)                                   | `docs/production/evidence/m4-academics-core-2026-07-29-local.md`                             |
| M7 HR core (local)                                          | `docs/production/evidence/m7-hr-core-2026-07-29-local.md`                                    |
| M8 library core (local)                                     | `docs/production/evidence/m8-library-core-2026-07-29-local.md`                               |
| M9 transport core (local)                                   | `docs/production/evidence/m9-transport-core-2026-07-29-local.md`                             |
| M10 canteen core (local)                                    | `docs/production/evidence/m10-canteen-core-2026-07-29-local.md`                              |
| M11 accounting core (local)                                 | `docs/production/evidence/m11-accounting-core-2026-07-29-local.md`                           |
| Pilot entitlement verify                                    | `docs/production/evidence/pilot-entitlements-pilot-rehearsal-1-*.md`                         |
| Controlled pilot (placeholder)                              | `docs/production/evidence/controlled-pilot-2026-07-29-placeholder.md`                        |
| Mobile QA                                                   | `docs/production/evidence/mobile-qa-2026-07-29-local.md`                                     |
| Core deploy gate (local)                                    | `docs/production/evidence/core-deploy-gate-2026-09-09-local.md`                              |
| Wave 3 + authenticated M4 browser                           | `docs/production/evidence/ga-wave3-2026-09-09T10-05-33-575Z-local.md`                        |
| Wave 4 + authenticated M7/M11 browser                       | `docs/production/evidence/ga-wave4-2026-09-09T09-11-26-852Z-local.md`                        |
| Wave 6 tenant registration                                  | `docs/production/evidence/ga-wave6-2026-09-09T09-12-03-362Z-local.md`                        |
| Local staging deploy                                        | `docs/production/evidence/staging-deploy-2026-09-09T15-19-12-999Z-local.md`                  |
| Local staging gates                                         | `docs/production/evidence/staging-gates-2026-09-09T15-23-18-249Z-local.md`                   |
| Full active-P0 smoke (local staging)                        | `docs/production/evidence/full-smoke-2026-09-09-local.md`                                    |
| Readiness dependency-failure rehearsal (local staging)      | `docs/production/evidence/readiness-dependency-failure-2026-09-09-local.md`                  |
| Monitoring incident/recovery webhook rehearsal (local mock) | `docs/production/evidence/monitoring-alert-rehearsal-2026-09-09-local.md`                    |
| P1-02 tenant-scope hardening (local PostgreSQL)             | `docs/production/evidence/p1-02-tenant-scope-2026-09-09-local.md`                            |
| P1-08 Redis authentication/transport hardening (local)      | `docs/production/evidence/p1-08-redis-transport-security-2026-09-09-local.md`                |
| P1-10 homework-create idempotency (local)                   | `docs/production/evidence/p1-10-homework-create-idempotency-2026-09-09-local.md`             |
| P1-09 mobile cold-start token refresh (local)               | `docs/production/evidence/p1-09-mobile-cold-start-refresh-2026-09-09-local.md`               |
| P1-16 compiled OpenAPI contract gate (local)                | `docs/production/evidence/p1-16-openapi-contract-gate-2026-09-09-local.md`                   |
| P1-17 Nepal timezone validation (local)                     | `docs/production/evidence/p1-17-nepal-timezone-validation-2026-09-09-local.md`               |
| P1-18 structured school address (local)                     | `docs/production/evidence/p1-18-school-profile-nepal-address-2026-09-09-local.md`            |
| P1-19 teacher-assignment null-safe uniqueness (local)       | `docs/production/evidence/p1-19-teacher-assignment-null-safe-uniqueness-2026-09-09-local.md` |

## Verification commands

```bash
pnpm staging:deploy:local && pnpm staging:api:local && pnpm smoke:pilot
pnpm provision:pilot-rehearsal && pnpm verify:pilot-entitlements && pnpm smoke:pilot:rehearsal
pnpm ga:verify:wave0   # through wave6
pnpm smoke:full        # active P0 + Platform; M13 remains excluded while frozen
```

## Remaining GA blockers (honest)

1. Provision a TLS staging host with non-placeholder secrets, trusted proxy/rate limiting, HTTPS origins, and production-grade private storage.
2. Run authenticated Playwright E2E on that TLS staging host.
3. Record real SMS/email/FCM/payment/storage provider sandbox and reconciliation evidence.
4. Obtain M7 Nepal statutory payroll CA verification (Wave 4 external gate).
5. Complete emulator/physical-device QA and a controlled pilot on production school #1 with owner sign-off.
6. Complete multi-school load/operations hardening, configure and prove monitoring/alerting on the TLS host, rehearse release rollback, then obtain GA owner sign-off. The local incident/recovery webhook rehearsal is green but is not hosted monitoring evidence.

M13 is not a blocker for the current controlled-pilot scope because it remains frozen, disabled, and excluded from acceptance. Any future production enablement requires an explicit owner reactivation decision plus its own security and device evidence.
