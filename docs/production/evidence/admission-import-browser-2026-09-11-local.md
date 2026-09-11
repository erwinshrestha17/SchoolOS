# Admission import review — local browser evidence

Verified on 2026-09-11 against localhost:3000 and the local rehearsal API after rebuilding the API with `pnpm --filter @schoolos/api exec nest build` (passed). Used the existing synthetic rehearsal admin; no admissions or school records were created or edited.

## Observed

- SchoolOS login rendered meaningful controls with no framework error overlay.
- Authenticated `/dashboard/admissions/iemis` loaded the existing validation-only batch and its failed row from the API.
- The review-queue button opened saved batch details. `document.activeElement.id` was `admission-import-details`, confirming focus transfer.
- Saved details identified validation-only execution, the batch result, and row requiring review.
- Aborting the review-queue request in the browser showed UNAVAILABLE, unknown review status, a retry action, and disabled pagination rather than a healthy zero.
- After removing interception and reloading, the API-backed queue recovered to one row and page 1, with both pagination controls disabled.

## Artifacts and limitations

Local screenshots: `output/playwright/admission-review-login-2026-09-11.png` and `output/playwright/admission-review-recovered-2026-09-11.png`.

A synthetic mocked multi-page response did not load successfully; no multi-page browser pass is claimed. The actual rehearsal data has only one review row. Request-failure coverage used browser interception, not a real provider outage. This does not verify interrupted-worker resume, valid CSV creation, guardian/finance side effects, full accessibility, staging, pilot, or production readiness.

## Subsequent API regression gate

After the inactive-student/ended-enrollment admission replay guard:

- `pnpm --filter @schoolos/api exec jest --runInBand`: 272 suites, 3,017 tests passed.
- `pnpm --filter @schoolos/api exec jest --config test/jest-e2e.json --runInBand`: 43 suites, 294 tests passed.

The HTTP test configuration substitutes Prisma, BullMQ, and Redis mocks; these results are not real-database/provider evidence. The passing HTTP run also logged scheduler/mock errors (missing notice-lifecycle tenant adapter and Redis `multi`); a green exit does not establish scheduler health.

Recovery trace: admission invoice creation uses an enrollment-scoped idempotency key, but `completeAdmissionSideEffects` emits `student.admitted` without awaiting handler completion. Automatic batch resume still needs durable completion/retry semantics and concurrent-worker/lifecycle protection; the existing active-state preflight alone does not supply these guarantees.
