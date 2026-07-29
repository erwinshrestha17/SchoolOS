# Controlled Pilot — Pilot Rehearsal School (`pilot-rehearsal-1`)

- Status: **Day 0 provisioned (local staging rehearsal)**
- Environment: local staging (Postgres `:5434`, API `:4000`)
- Grade scope: Grades 1–10 (SCHOOL)
- Canonical checklist: [CONTROLLED_PILOT_CHECKLIST.md](../CONTROLLED_PILOT_CHECKLIST.md)

## Preconditions

| Item | Status | Evidence |
|---|---|---|
| Staging smoke + browser E2E | PASS (local) | [staging-gates-2026-07-29-local.md](./staging-gates-2026-07-29-local.md), [staging-browser-e2e-2026-07-29-local.md](./staging-browser-e2e-2026-07-29-local.md) |
| Backup/restore drill (local) | PASS | [backup-restore-rehearsal-2026-07-29-local.md](./backup-restore-rehearsal-2026-07-29-local.md) |
| Support/on-call documented | Pending | Assign before production pilot |
| Training trimmed to Wave 1 | Ready | [SCHOOLOS_PRODUCTION_RUNBOOK.md](../SCHOOLOS_PRODUCTION_RUNBOOK.md) §5 |

## Wave 1 entitlement boundary

| Module key | Wave | Expected state |
|---|---|---|
| `module.students` | M1 | **ON** |
| `module.attendance` | M2 | **ON** |
| `module.activity` | M5 | **ON** (via plan/matrix) |
| `module.homework` | M6 | **ON** |
| `module.notifications` | M12 | **ON** |
| `module.notices` | M15 | **ON** |
| `module.fees` | M3 | **OFF** (override) |
| `module.exams` | M4 | **OFF** (override) |
| `module.hr` / `module.payroll` | M7 | **OFF** (override) |
| `module.library` | M8 | **OFF** (override) |
| `module.transport` | M9 | **OFF** (override) |
| `module.canteen` | M10 | **OFF** (override) |
| `module.accounting` | M11 | **OFF** (override) |
| `module.learning` | M13 | **OFF** (override) |
| `module.intelligence` | M14 | **OFF** (override) |

Verification: [pilot-entitlements-pilot-rehearsal-1-2026-07-29.md](./pilot-entitlements-pilot-rehearsal-1-2026-07-29.md) — **PASS** (2026-07-29 local staging)

## Day 0 — Platform provisioning

- [x] Tenant created: `pilot-rehearsal-1` / **Pilot Rehearsal School** (`7de9c32a-16b5-46b9-bb8b-f5dbaa454a0f`)
- [x] Standard plan subscription ACTIVE
- [x] Wave 1 entitlement overrides applied (12 overrides incl. `feature.hr.staff_records`, `feature.accounting.basic_finance`)
- [x] Initial admin: `admin@pilot-rehearsal.schoolos.test` / `PilotRehearsal1!` (override via `PILOT_REHEARSAL_ADMIN_PASSWORD`)
- [x] Entitlement boundary verified (`pnpm verify:pilot-entitlements` — all 8 checks PASS)
- [ ] Platform operator confirms tenant at `/platform/schools/{tenantId}`

Provision log: [controlled-pilot-pilot-rehearsal-1-provision-log.md](./controlled-pilot-pilot-rehearsal-1-provision-log.md)

```bash
pnpm provision:pilot-rehearsal
pnpm seed:pilot-rehearsal-personas
pnpm staging:api:local
pnpm verify:pilot-entitlements   # PASS 2026-07-29
pnpm smoke:pilot:rehearsal         # PASS 2026-07-29 (Wave 1 mode)
```

### Automated verification (2026-07-29 local staging)

| Gate | Result | Notes |
|---|---|---|
| `pnpm verify:pilot-entitlements` | **PASS** | Wave 1 routes 200; fees/exams/learning/library 403 |
| `pnpm smoke:pilot:rehearsal` | **PASS** | 41 checks; Wave 1 personas + fail-closed Wave 2+ routes |

Persona seed (`pnpm seed:pilot-rehearsal-personas`): Class 1/A+B, 3 subjects, 7 smoke users, 2 students + guardians, teacher assignments. Password: `PilotRehearsal1!`.

Smoke Wave 1 adaptations (`SMOKE_WAVE1_PILOT=true`): parent fees 403, principal mobile 403 (STANDARD tier), staff/accountant/driver gated routes 403; class/subject teacher full scope PASS.

**Fixes during Day-0:** onboarding checklist `class_teachers` count bug in [`platform.service.ts`](../../../apps/api/src/platform/platform.service.ts); legacy plan feature key normalization in [`entitlements.service.ts`](../../../apps/api/src/plans/entitlements.service.ts).

## Day 0 — School setup (operator / school admin)

Onboarding API (`GET /settings/onboarding`): **79%** (11/14) — required Wave 1 items complete except branding.

Complete at `/dashboard/settings/onboarding`:

- [x] School profile (identity settings — seeded `school_name`, `school_address`, `school_phone`)
- [ ] Branding files (logo, seal, signature) — **manual browser upload** at `/dashboard/settings/school/branding`
- [x] Academic year (seeded on provision)
- [x] Classes and sections (Class 1 / A + B for smoke roster fixture)
- [x] Subjects configured (Nepali, English, Mathematics)
- [x] Class teachers assigned (Section A → `classteacher.1a@schoolos.com`)
- [x] Subject teachers assigned (Mathematics → `subjectteacher.math@schoolos.com`)
- [x] Users/staff invited (principal, teachers, staff, accountant, driver)
- [x] Students imported or created (2 students Class 1/A)
- [ ] Communication settings configured (optional for Wave 1)

**Browser note:** Admin `mustChangePassword=true` redirects to `/dashboard/settings/personal/security` before onboarding UI; change password or clear flag for full browser walkthrough.

## Day 1 — People and records

- [ ] Staff accounts with audited temporary credentials
- [ ] 2–5 students via admissions wizard or CSV (dry-run then confirm)
- [ ] Guardians linked: ACTIVE + VERIFIED + APPROVED + capabilities
- [x] Parent mobile login verified for one linked child — smoke PASS (`guardian.c01a001@schoolos.test`)

## Day 1 — Daily operations (Wave 1 only)

Runbook steps 1–11 from [SCHOOLOS_PRODUCTION_RUNBOOK.md](../SCHOOLOS_PRODUCTION_RUNBOOK.md) §5 (skip steps 12–15).

- [ ] Homeroom teacher marks attendance
- [ ] Attendance correction workflow tested
- [ ] Homework assigned (teacher + parent surfaces)
- [ ] Notice published (M15→M12 honest delivery state)
- [ ] Timetable visible where entitled
- [ ] Activity post with media consent check (M5)

## Security spot checks

- [x] Disabled modules fail closed in API (DEF-06) — verified by `pnpm verify:pilot-entitlements`
- [ ] Disabled modules fail closed in UI (DEF-06)
- [x] Parent sees linked children only — smoke parent scope PASS
- [x] Teacher sees assigned scope only — smoke class/subject teacher scope PASS
- [ ] Suspended tenant blocks writes

```bash
pnpm verify:pilot-entitlements   # automated entitlement boundary
pnpm smoke:pilot:rehearsal       # after Day-0 persona setup
```

## Exit criteria — Controlled pilot validated

- [ ] One school week without engineering intervention
- [ ] No unresolved P0 incidents
- [ ] Feedback triaged with owner
- [ ] Product owner sign-off

**Honest stage:** Rehearsal tenant provisioned locally; **not** controlled-pilot validated until exit criteria above are met on a real school.
