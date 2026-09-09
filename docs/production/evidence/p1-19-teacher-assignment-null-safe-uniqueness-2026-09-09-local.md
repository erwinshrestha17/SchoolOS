# P1-19 Teacher Assignment Null-Safe Uniqueness — Local Evidence

Date: 2026-09-09  
Environment: local repository plus Docker PostgreSQL 16 staging simulation  
Evidence boundary: local database and automated checks only; this is not certificate-verified staging, controlled-pilot, RC, or GA evidence.

## Risk closed locally

PostgreSQL ordinary unique indexes treat nullable values as distinct. The existing canonical `TeacherAssignment` key therefore allowed concurrent duplicates when `subjectId` or `componentScope` was null. The legacy `SubjectTeacherAssignment` key had the same gap for class-wide rows where `sectionId` was null, and its declared scope omitted `classId`.

## Change

- Added migration `20260909153000_teacher_assignment_null_safe_uniqueness`.
- The migration fails closed if either table already contains duplicate authority scopes; it does not delete, merge, or select a historical winner.
- Both existing unique indexes are recreated with PostgreSQL `NULLS NOT DISTINCT` while retaining their stable deployed index names.
- The legacy subject-teacher scope now includes `classId`, so class-wide authority is bounded to the intended class.
- Prisma source schema and the compiled schema declare the corrected legacy compound key.
- The schema hardening contract verifies both null-safe indexes remain present.

## Verification

- Pre-migration staging audit: 0 canonical duplicate scopes; 0 legacy duplicate scopes — PASS.
- Duplicate preflight probe in disposable database `schoolos_p119_duplicate_preflight_20260909`: two historical null-scope rows caused the migration to abort with its explicit duplicate-scope error before index replacement — PASS; database removed.
- Populated local staging migration: all 112 migrations applied; new migration applied without rewriting rows — PASS.
- Post-migration base seed, geography seed, and canonical teacher-assignment backfill — PASS; 25 class-teacher and 192 subject-teacher assignments backfilled idempotently.
- PostgreSQL index inspection: both deployed indexes report `NULLS NOT DISTINCT`; legacy key includes `classId` — PASS.
- Transaction-scoped SQL probes: a duplicate canonical null-subject/null-component scope and a duplicate legacy null-section scope were both rejected with `unique_violation`; probe data rolled back — PASS.
- Clean replay of all 112 migrations into throwaway database `schoolos_p119_replay_20260909` — PASS; `prisma migrate status` reported up to date and the database was removed.
- Prisma schema validation — PASS.
- Schema hardening contract: 6/6 — PASS.
- Focused schema-test lint: zero errors or warnings — PASS.
- API typecheck and build — PASS.
- Full API unit suite: 272 suites, 2,994 tests — PASS.
- Local staging deploy — PASS: `staging-deploy-2026-09-09T15-19-12-999Z-local.md`.
- Local staging gate bundle — PASS: `staging-gates-2026-09-09T15-23-18-249Z-local.md`.

## Remaining boundary

- Apply and inspect the migration on certificate-verified TLS staging before pilot data is onboarded.
- The canonical/legacy dual-write compatibility architecture still exists; this constraint prevents duplicate scopes but does not retire either source.
- Concurrent multi-instance assignment mutation behavior still needs TLS staging/load evidence. The database now preserves integrity if two writers race.
