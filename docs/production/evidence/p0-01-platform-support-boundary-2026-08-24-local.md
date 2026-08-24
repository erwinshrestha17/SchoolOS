# P0-01 Platform and Support Boundary Closure (2026-08-24, local)

Status: **PARTIAL — local development evidence only**

Base inspected: `02d90cdb` (`fix(settings): harden Principal configuration boundary (#113)`). The underlying Platform/school-domain and purpose-limited support implementation is already present in current history at `cd397c6d`; this batch closes current-main regressions and web truthfulness gaps around that boundary.

## Scope completed in this batch

- Kept Platform support access explicitly read-only on student directory and profile surfaces even if a stale school permission appears in the client session.
- Suppressed support-session fee, protected-document, QR/identity, attendance, lifecycle, guardian-administration, profile-edit, admission, export, and row action affordances.
- Replaced a false green student-profile state with a neutral, explicit scoped-support projection message.
- Preserved the backend's minimal `STUDENT_RECORDS` projection: no document/file metadata, finance, QR or identity credentials, health/safeguarding details, activity, or unapproved helper reads.
- Added explicit cross-module entitlement declarations to the Principal approval queue, Principal operations summary, and institutional settings-domain mutation controllers. Per-module/per-setting authorization remains service-owned.
- Corrected settings-domain idempotency replay coverage to use the actual committed request fingerprint and added collision coverage for the same key with a different payload.
- Fixed current-main Principal summary typing and loading-state drift.
- Aligned web contract tests with the existing role-aware navigation wrapper/base split and current Principal leadership/settings behavior; no deferred-module runtime work was added.
- Updated the Principal design package to use the current `Principal Home` route label consistently.

## Authorization and data-boundary evidence

| Boundary | Local evidence |
|---|---|
| Platform session versus school session | Existing current-history guard, JWT, route-allowlist, HTTP hardening, and domain-boundary suites pass |
| Support override writes | Client write affordances are explicitly suppressed; backend support override remains read-only and exact-scope guarded |
| Student support projection | Backend service selects only approved identity, enrollment, and bounded guardian-contact fields; protected/sensitive relations are not queried |
| Tenant isolation | Tenant-isolation integration suite passed 16/16 during this goal run |
| Principal cross-module reads | Controllers carry an explicit no-single-module declaration; services retain per-source entitlement checks and locked states |
| Settings mutation | Exact per-domain/per-key permissions remain backend-owned; idempotent replay and payload collision are covered |

## Verification run

| Check | Result | Detail |
|---|---|---|
| API unit suite | PASS | 265 suites / 2,761 tests |
| Web contract suite | PASS | 86 suites / 606 tests |
| Focused Platform/security unit selection | PASS | 15 suites / 412 tests |
| Platform hardening HTTP suite | PASS | 53/53 |
| Tenant-isolation integration suite | PASS | 16/16 |
| Web TypeScript | PASS | Rerun after the API script rebuilt `packages/core` |
| API TypeScript | PASS | `tsc --noEmit` rerun after shared artifacts settled |
| Changed web ESLint | PASS | Zero warnings/errors |
| Changed API ESLint | PASS | Zero warnings/errors |
| Changed API Prettier | PASS | All four changed API files match repository style |
| Core build/import/artifact checks | PASS | Generated artifacts and imports verified during this goal run |
| Prisma schema validation | PASS | Current schema valid |
| OpenAPI verification | PASS | Contract gate passed |
| Empty-database migration replay | PASS | Existing migration history applied to a disposable local PostgreSQL database; disposable database removed |
| Patch whitespace | PASS | `git diff --check` |

Primary rerun commands:

```bash
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/web test
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/api exec tsc --noEmit
pnpm --filter @schoolos/api exec prettier --check \
  src/advanced-operations/principal-approval-queue.controller.ts \
  src/operational-summary/principal-operations-summary.controller.ts \
  src/settings/settings-domain-mutation.service.spec.ts \
  src/settings/settings-domain.controller.ts
git diff --check
```

The API suite intentionally logs expected negative-path errors and warnings; its authoritative result is 265 passing suites and 2,761 passing tests.

## Accessibility and offline/Edge boundary

- The support states use text in addition to color, remove unavailable actions from keyboard navigation, and retain existing shared controls and focus behavior.
- Static contracts and TypeScript were verified. No browser, keyboard walkthrough, screen-reader run, mobile-device run, or visual regression capture was performed for this batch.
- Support override is an online, time-bounded Platform operation. This batch did not alter School Edge synchronization, offline queues, conflict recovery, or fiscal finalization behavior.

## Honest release posture

- **Do claim:** the scoped P0-01 boundary changes and listed local verification passed.
- **Do not claim:** all P0 work complete, staging validated, controlled-pilot validated, release-candidate ready, GA ready, production ready, WCAG 2.2 AA fully validated, or offline/Edge runtime validated.
- Active P0 work remains open across authorization completion, attendance correctness, marks lifecycle, Nepal compliance profiling/IEMIS, fiscal integrity, privacy, offline/Edge convergence, operational recovery, and release evidence.
- M8 Library, M9 Transport, M10 Canteen, M13 Learning, and M14 Intelligence/AI remain deferred/frozen. Existing compatibility code and tests were preserved; no feature work was added.

## Next release action

Continue the P0-01 authorization inventory from this clean local slice, prioritizing unresolved backend teacher-assignment, guardian-scope, tenant-isolation, and cache-invalidation evidence before advancing to P0-02 attendance correctness. Any staging or pilot claim still requires environment-specific execution and recorded evidence.
