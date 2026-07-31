# P0-01 Authorization, Tenant Isolation and Scope Enforcement (2026-07-31, local)

Status: **PARTIAL (local development complete for this hardening slice; not staging / controlled-pilot validated)**

Scope: Close remaining P0-01 gaps around capability contract completeness, `RESULT_REVIEW` assignment enforcement, authorization denial audit vocabulary, background-job missing-tenant fail-closed proof, mobile access-changed cache invalidation, and a static authorization matrix contract.

## Implementation completed in this slice

- Added `TeacherCapability.RESULT_REVIEW` and wired `ResultsService` teacher previews through `TeacherScopeService` instead of a class/section combo list alone.
- Documented P0-01 required capability aliases onto existing enforcement surfaces (`SUBJECT_HOMEWORK_WRITE` → `SUBJECT_HOMEWORK_CREATE`, `SUBJECT_MARKS_WRITE` → `MARKS_ENTER`, `CLASS_ACADEMIC_OVERVIEW` → `HOMEROOM_ACADEMIC_SUMMARY_READ`, `CLASS_TEACHER_REMARK_WRITE` → `CLASS_TEACHER_REMARK`; publish/unlock/guardian-manage/file remain RBAC / FileRegistry).
- Added `authorization-audit` helpers and wired guardian capability denials in attendance and student-QR paths.
- Extended `runTenantScopedJob` missing-tenant fail-closed unit coverage.
- Mobile: access-changed permission codes clear private caches; parent controller prunes unlinked child caches; teacher attendance discards unauthorized queued drafts; parent UI shows controlled access-changed state.

## Migrations

None. No Prisma schema change was required for this slice.

## Commands run and results

| Check | Result | Detail |
|---|---|---|
| `pnpm db:validate` | PASS | Prisma schema valid |
| `pnpm verify:openapi` | PASS | OpenAPI gate passed |
| Focused API unit/contract suites (7) | PASS | 71/71 |
| `test/teacher-scope-authorization.e2e-spec.ts` | PASS | 17/17 |
| `pnpm --filter @schoolos/api typecheck` | PASS | |
| `pnpm --filter @schoolos/web typecheck` | PASS | |
| Flutter focused tests | PASS | 11/11 (`parent_controller_test`, `private_data_cleanup_service_test`) |

```bash
pnpm db:validate
pnpm verify:openapi
pnpm --filter @schoolos/api exec jest \
  src/teacher-scope/p0-01-capability-contract.spec.ts \
  src/common/security/p0-01-authorization-matrix.contract.spec.ts \
  src/common/security/authorization-audit.spec.ts \
  src/common/security/parent-scope.spec.ts \
  src/plans/processor-tenant.context.spec.ts \
  src/academics/results.service.spec.ts \
  src/teacher-scope/teacher-scope.service.spec.ts \
  --runInBand
pnpm --filter @schoolos/api exec jest --config ./test/jest-e2e.json \
  test/teacher-scope-authorization.e2e-spec.ts --runInBand
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/web typecheck
cd apps/schoolos_mobile && flutter test \
  test/parent_controller_test.dart \
  test/private_data_cleanup_service_test.dart
```

## Honest posture

- **Do claim:** Local hardening and focused regression for the listed authorization gaps.
- **Do not claim:** Staging validated, controlled-pilot validated, GA/production release, or that every historical module path (frozen M13 Learning legacy assignment reads, full browser/device multi-user offline revocation matrix) is closed.
- Period attendance write APIs remain daily/homeroom-shaped; `PERIOD_ATTENDANCE_MARK` is defined, rule-tested, and reserved for subject-period writes when that workflow is exposed.
