# SchoolOS GA Program Tracker

**Owner-approved scope (2026-07-29):** M0–M12 + M15 + M13 (Wave 5); M14 excluded.
**First production target:** one real school (Wave 1).
**Honest release stage:** Local staging validated (smoke + authenticated browser E2E); **not** TLS VPS staging; **not** controlled-pilot validated; **not** GA.

Canonical plan: `.cursor/plans/schoolos_full_ga_program_9f539c81.plan.md` (do not edit from implementation PRs; update this tracker instead).

## Wave status

| Wave | Goal | Implementation | Local verification | Ops evidence |
|---|---|---|---|---|
| 0 | P0 cross-cutting, doc sync, staging ops | Complete | PASS (`ga:verify:wave0`, `smoke:pilot`, browser E2E) | TLS VPS staging pending |
| 1 | Core modules for school #1 | Complete | PASS (`ga:verify:wave1`, flutter 539 tests) | Controlled pilot + device QA pending |
| 2 | M3 full fees + digital payments | verify:m3-fees + mock gateway + collection seed | Local HTTP verify (`verify:m3-fees`, `ga:verify:wave2`) | Production eSewa/Khalti TLS sandbox pending |
| 3 | M4 exams/report cards/promotion | verify:m4-academics + report-card seed | Local HTTP verify (`verify:m4-academics`, `ga:verify:wave3`) | Staging exams browser E2E optional |
| 4 | M7–M11 operational modules | verify:m7–m11 HTTP slices | Local HTTP verify (`ga:verify:wave4`) | M7 Nepal CA sign-off external |
| 5 | M13 Learning unfreeze | Route guard + staging enable | PASS (`smoke:learning`, `ga:verify:wave5`) | Security review + device proof pending |
| 6 | Multi-school self-serve + GA sign-off | Transactional tenant register | PASS (`ga:verify:wave6`) | Load test + owner sign-off pending |

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
- [x] Flutter analyze + 539 unit/widget tests
- [ ] Controlled pilot rehearsal tenant provisioned — see `controlled-pilot-pilot-rehearsal-1-2026-07-29.md`
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
- [ ] Full staging browser E2E with `SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true`

## Wave 4 checklist

- [x] `verify:m7-hr`, `verify:m8-library`, `verify:m9-transport`, `verify:m10-canteen`, `verify:m11-accounting`
- [x] `ga:verify:wave4` wires HTTP verify slices + optional M7–M11 role-boundary E2E
- [ ] M7 Nepal statutory payroll CA external sign-off

## Wave 2–6 code highlights

| Wave | Deliverable | Status |
|---|---|---|
| 2 | `verify:m3-fees`, mock gateway, parent sandbox, online webhook idempotency | Implemented |
| 3 | `verify:m4-academics` + report-card fixture seed | Implemented |
| 4 | `verify:m7-hr` … `verify:m11-accounting` HTTP persona boundaries | Implemented |
| 5 | `LearningRouteGuard` + staging `module.learning` enable for smoke | Implemented |
| 6 | Transactional tenant register + duplicate admin email check | Implemented |

## Evidence index

| Artifact | Path |
|---|---|
| GA Wave 0–6 verification | `docs/production/evidence/ga-wave{0-6}-2026-07-29-local.md` |
| Staging browser E2E | `docs/production/evidence/staging-browser-e2e-2026-07-29-local.md` |
| Controlled pilot rehearsal | `docs/production/evidence/controlled-pilot-pilot-rehearsal-1-2026-07-29.md` |
| M0 platform core (local) | `docs/production/evidence/m0-platform-core-2026-07-29-local.md` |
| M1 admissions core (local) | `docs/production/evidence/m1-admissions-core-2026-07-29-local.md` |
| M2 attendance core (local) | `docs/production/evidence/m2-attendance-core-2026-07-29-local.md` |
| M15 notices core (local) | `docs/production/evidence/m15-notices-core-2026-07-29-local.md` |
| M6 homework core (local) | `docs/production/evidence/m6-homework-core-2026-07-29-local.md` |
| M5 activity core (local) | `docs/production/evidence/m5-activity-core-2026-07-29-local.md` |
| M3 fees core (local) | `docs/production/evidence/m3-fees-core-2026-07-29-local.md` |
| M4 academics core (local) | `docs/production/evidence/m4-academics-core-2026-07-29-local.md` |
| M7 HR core (local) | `docs/production/evidence/m7-hr-core-2026-07-29-local.md` |
| M8 library core (local) | `docs/production/evidence/m8-library-core-2026-07-29-local.md` |
| M9 transport core (local) | `docs/production/evidence/m9-transport-core-2026-07-29-local.md` |
| M10 canteen core (local) | `docs/production/evidence/m10-canteen-core-2026-07-29-local.md` |
| M11 accounting core (local) | `docs/production/evidence/m11-accounting-core-2026-07-29-local.md` |
| Pilot entitlement verify | `docs/production/evidence/pilot-entitlements-pilot-rehearsal-1-*.md` |
| Controlled pilot (placeholder) | `docs/production/evidence/controlled-pilot-2026-07-29-placeholder.md` |
| Mobile QA | `docs/production/evidence/mobile-qa-2026-07-29-local.md` |

## Verification commands

```bash
pnpm staging:deploy:local && pnpm staging:api:local && pnpm smoke:pilot
pnpm provision:pilot-rehearsal && pnpm verify:pilot-entitlements && pnpm smoke:pilot:rehearsal
pnpm ga:verify:wave0   # through wave6
pnpm smoke:learning    # after staging deploy (M13 enabled on smoke tenant only)
```

## Remaining GA blockers (honest)

1. Controlled pilot on production school #1 with owner sign-off
2. Authenticated Playwright E2E on TLS staging host
3. M7 Nepal statutory payroll CA verification (Wave 4 external gate)
4. M13 security review before production enablement on school #1
5. Multi-school load/ops hardening + GA owner sign-off (Wave 6)
