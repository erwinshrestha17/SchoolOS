# SchoolOS GA Program Tracker

**Owner-approved scope (2026-07-29):** M0–M12 + M15 + M13 (Wave 5); M14 excluded.
**First production target:** one real school (Wave 1).
**Honest release stage:** Internal QA ready locally with staging smoke green; **not** controlled-pilot validated; **not** GA.

Canonical plan: `.cursor/plans/schoolos_full_ga_program_9f539c81.plan.md` (do not edit from implementation PRs; update this tracker instead).

## Wave status

| Wave | Goal | Implementation | Local verification | Ops evidence |
|---|---|---|---|---|
| 0 | P0 cross-cutting, doc sync, staging ops | Complete | PASS (`ga:verify:wave0`, `smoke:pilot`) | TLS VPS staging pending |
| 1 | Core modules for school #1 | Complete | PASS (`ga:verify:wave1`, flutter 539 tests) | Controlled pilot + device QA pending |
| 2 | M3 full fees + digital payments | Scaffold + M11 mapping seed | PASS (`ga:verify:wave2`) | Payment provider sandbox pending |
| 3 | M4 exams/report cards/promotion | Grading scale editor | PASS (`ga:verify:wave3`) | Staging exams E2E pending |
| 4 | M7–M11 operational modules | Existing modules | PASS (`ga:verify:wave4`) | M7 Nepal CA sign-off external |
| 5 | M13 Learning unfreeze | Route guard + staging enable | PASS (`smoke:learning`, `ga:verify:wave5`) | Security review + device proof pending |
| 6 | Multi-school self-serve + GA sign-off | Transactional tenant register | PASS (`ga:verify:wave6`) | Load test + owner sign-off pending |

## Wave 0 checklist

- [x] Doc sync, P0 cross-cutting, entitlement/CLS, smoke fixture scripts
- [x] `pnpm smoke:pilot` green on local staging (5434/6380/4000)

## Wave 1 checklist

- [x] M15 notice approval write UI + decision panel
- [x] Wave 1 onboarding checklist (class teachers, teacher assignments, school-plane links)
- [x] Settings nav → Day-1 onboarding (`/dashboard/settings/onboarding`)
- [x] M5 mobile media consent submit guard
- [x] Flutter analyze + 539 unit/widget tests
- [ ] Mobile device QA (emulator + physical) — see `mobile-qa-2026-07-29-local.md`
- [ ] Controlled pilot checklist for production school #1 — see `controlled-pilot-2026-07-29-placeholder.md`
- [ ] M12 provider sandbox staging proof on TLS host

## Wave 2–6 code highlights

| Wave | Deliverable | Status |
|---|---|---|
| 2 | Default `FEE_PAYMENT` accounting source mapping on tenant provision | Implemented |
| 3 | `grading_scale` JSON editor in academic policy settings | Implemented |
| 4 | Existing M7–M11 web workspaces + role-boundary E2E scaffold | Existing |
| 5 | `LearningRouteGuard` + staging `module.learning` enable for smoke | Implemented |
| 6 | Transactional tenant register + duplicate admin email check | Implemented |

## Evidence index

| Artifact | Path |
|---|---|
| GA Wave 0–6 verification | `docs/production/evidence/ga-wave{0-6}-2026-07-29-local.md` |
| Staging deploy | `docs/production/evidence/staging-deploy-2026-07-29-local.md` |
| Controlled pilot (placeholder) | `docs/production/evidence/controlled-pilot-2026-07-29-placeholder.md` |
| Mobile QA | `docs/production/evidence/mobile-qa-2026-07-29-local.md` |

## Verification commands

```bash
pnpm staging:deploy:local && pnpm staging:api:local && pnpm smoke:pilot
pnpm ga:verify:wave0   # through wave6
pnpm smoke:learning    # after staging deploy (M13 enabled on smoke tenant only)
```

## Remaining GA blockers (honest)

1. Controlled pilot on production school #1 with owner sign-off
2. Authenticated Playwright E2E on TLS staging host
3. M7 Nepal statutory payroll CA verification (Wave 4 external gate)
4. M13 security review before production enablement on school #1
5. Multi-school load/ops hardening + GA owner sign-off (Wave 6)
