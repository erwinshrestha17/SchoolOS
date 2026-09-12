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

## Combined baseline after test-adapter updates

At checkout `b41776ef`, the combined HTTP gate passed **43 suites / 294 tests** using `pnpm --filter @schoolos/api exec jest --config test/jest-e2e.json --runInBand --silent`. The expected exception-filter test logged its synthetic internal error; no Redis `eval` adapter failure remained in this run.

Root `pnpm lint` also passed: artifact compilation, core import boundary, API Prettier check, and web ESLint. This command does not run full API ESLint. These are local checks, not deployment or end-to-end provider validation.

## Delivery recipient-batch rollback

After transactional queued/skipped recipient creation, the isolated integration suite passed **5 tests**. The added test calls actual `CommunicationsService.recordDeliveryRecords` with real Prisma/PostgreSQL writes. A valid queued recipient is followed by a skipped recipient referencing a nonexistent user. PostgreSQL returns P2003; the source has zero persisted delivery rows and dispatch is never called.

Audience-policy partitioning, usage checks, Redis lock responses, and provider dispatch are isolated test substitutes. This proves transaction rollback across both queued and skipped sets, not real policy evaluation, recipient snapshot preservation, concurrent-worker fencing, or post-commit dispatch recovery.

## Delivery retry compare-and-set

The isolated suite now passes **6 tests**. The added race passes the same persisted FAILED delivery at retryCount 2 to two actual DeliveryRetryService claim paths concurrently. PostgreSQL permits one claim; the other rejects. The queue adapter is called once with attempt 3, and the persisted row is RETRY_PENDING with retryCount 3. Provider readiness and sending are mocked; this is real database claim evidence, not real queue/provider delivery or full HTTP authorization proof.

## 2026-09-12: bounded intake and dispatch-policy fencing

The isolated PostgreSQL suite passes **8 tests**. Additional real-database cases verify:

- A 2,000-recipient, three-channel intake persists 6,000 rows using batches of 500 within the existing atomic transaction. Replaying the source neither rewrites original content nor invokes dispatch again. Audience policy, usage, Redis and provider dispatch remain mocked; this is a bounded synthetic capacity check, not a load or production-throughput claim.
- An in-app retry is queued as attempt 1. Processing old attempt 0 never invokes policy or changes the row. Cancelling its persisted source event before processing attempt 1 produces SKIPPED with no sent timestamp. The current policy diagnostic replaces an earlier QUEUE_HANDOFF_UNCONFIRMED marker. Queue transport and plan checks are mocked; the actual retry service, worker, policy and PostgreSQL state transitions run.

The combined API unit suite passes **272 suites / 3,078 tests**. Web tests pass **665 tests**, including six component-handler/element-prop tests for retained reasons, FAILED responses, uncertain outcomes, pending diagnostics and read-only support. These web tests mock hooks and transport; they are not browser evidence. The API HTTP gate passes **43 suites / 294 tests** with loopback access enabled; the restricted-sandbox attempt failed on local socket binding before the affected HTTP assertions.

Automatic crash recovery, durable provider-attempt start tracking, provider exactly-once delivery, real queue loss/restart recovery and staging/pilot validation remain outstanding. Current worker fencing rejects stale jobs before policy/provider work and prevents late results from overwriting newer or terminal rows; it does not exclude a state change while a provider call is in flight.

## Local web verification

Playwright CLI loaded the actual `/dashboard/notifications/failures` page at `http://127.0.0.1:3101` with synthetic browser-only session/API responses. At 1440×900 and 390×844, the retry flow opened its confirmation dialog, accepted a reason, displayed a pending handoff diagnostic, retained the reason and disabled another submit. Page identity was SchoolOS, content was nonblank, no framework error overlay appeared, and the final console check had zero errors/warnings. Screenshots were inspected; dialog body spacing was corrected and the interaction was rerun. The temporary QA servers and browser session were stopped afterward.

This is rendered UI evidence with mocked transport, not cookie-authentication, backend authorization, provider, staging or real-school evidence. The Browser skill was unavailable; the cached Playwright CLI was used. Web lint, web typecheck, **665 web tests**, and the optimized web build passed. `pnpm verify:openapi` passed, including core/API build and Prisma generation, with **1,152 paths / 1,334 operations / 475 schemas**. No deployment or production claim follows from these checks.
