# Admission import PostgreSQL atomicity — local evidence

## Scope and result

`apps/api/test/admission-import-atomicity.int-spec.ts`: **2 tests passed** against a newly created disposable loopback PostgreSQL database, `schoolos_admission_atomic_test` (local container port 5434). API `tsc --noEmit` also passed.

The database was initialized with a schema-only, no-owner, no-privileges dump of the local rehearsal database. No school records were copied. This verifies behavior against that schema snapshot, not a clean migration replay.

The actual `AdmissionsService.createAdmission` and core student/enrollment/lifecycle/audit writes execute through PrismaService and real PostgreSQL transactions. Reference validation and post-commit side effects are stubbed; fixtures contain synthetic identities only.

- A deliberately failing post-commit follow-up leaves one enrollment, lifecycle entry, and a PROCESSING import row linked to the committed student.
- An existing batch/row unique key rejects import linkage; the new student is absent, enrollment and audit counts remain unchanged, the pre-existing row is untouched, and follow-up work is not called.

## Reproduction boundary

Use the API integration Jest configuration and filter `admission-import-atomicity`, setting `SCHOOLOS_ADMISSION_TEST_DATABASE_URL` explicitly to a schema-initialized loopback database named exactly `schoolos_admission_atomic_test`. Without that variable the suite is skipped; other hosts/database names are rejected. Never point this test at a school database.

Synthetic fixtures are retained in the disposable database for inspection. Tests create a distinct tenant each run and do not delete authoritative records.

## Not established

This does not prove HTTP authorization, real guardian/reference validation, provider success, process-kill/restart recovery, concurrent import workers, automated resume, legacy-batch reconciliation, browser behavior, staging, controlled-pilot readiness, or production readiness.

## 2026-09-11 extension: M12 terminal-state races

The same opt-in isolated PostgreSQL suite now passes **4 tests**, retaining both admission atomicity tests and adding:

- Five real PostgreSQL races per run between dispatch success and two failure callbacks. Every persisted event ends DISPATCHED with failure fields cleared; replaying success preserves the dispatch timestamp.
- Concurrent success/failure callbacks leave a previously CANCELLED event unchanged.

These call the actual NotificationEventService status methods through PrismaService. Plans/audit dependencies are unused by those methods; events are directly seeded synthetic records, so this does not exercise event acceptance, recipient resolution, or provider delivery. API typecheck passed. No real-school database was used or copied.

## 2026-09-11 extension: delivery lock ownership

The compare-and-delete Lua script was extracted from the current CommunicationsService source and executed against authenticated local rehearsal Redis with a random test-only key. An original owner acquired a 50 ms lease; after expiry a replacement acquired the same key. Releasing with the original token returned 0 and preserved the replacement token; releasing with the replacement returned 1 and removed the key. All assertions passed. No application keys were modified.

The full API unit gate subsequently passed 272 suites / 3,029 tests. This establishes token-aware release behavior, not lease renewal, long-running-worker fencing, complete delivery deduplication, or production readiness.
