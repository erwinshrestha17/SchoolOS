# Admission import partial creation evidence

Date: 2026-09-09. Local unit and type-check evidence only.

Admission creation commits the student and enrollment before processing finance
and document side effects. A later failure previously produced a failed import
row without the committed student identity.

The failure path now looks up the exact tenant and row operation ID and retains
the existing student identity in the result and persisted import row. The web
result links to that student and explains that follow-up processing needs review.
The successful-row counter is labelled Completed to avoid implying failed rows
could not have created a student.

Verification: admissions service 40/40 tests passed, including the new partial
creation regression; API and web TypeScript checks passed; touched web component
lint reported no errors; git diff check passed.

Saved import history now exposes the existing tenant-scoped batch-detail API,
with selected-batch fetching, loading/error/retry states, authoritative batch
counts, and student links for persisted partial failures. Support override cannot
open this panel. History uses server pagination so older batches remain reachable.
The frontend detail contract now matches the endpoint rather than incorrectly
inheriting list-only count and audit fields. Raw imported data and internal error
payloads are not rendered.

Additional verification: web typecheck, touched component/API client ESLint, all
10 existing M1 workspace contract checks, and git diff check passed. These checks
do not establish rendered interaction or access-control integration evidence.

This is a partial recovery improvement. Durable batch resume after process loss
and explicit compensation remain open.
No batch rollback or production-readiness claim is made.

## Local browser follow-up

On 2026-09-09, the real localhost web app and local rehearsal API were opened in
Chromium, with the SchoolOS title, admissions route, and synthetic rehearsal
tenant verified before interaction. A deliberately invalid synthetic CSV was
validated only; the UI reported zero ready rows, one failed row, and no student
creation. Confirmation stayed disabled. The saved batch was opened in history,
the page reloaded, and the same persisted batch reopened. Its detail panel showed
Validation only, the authoritative counts, and row 2 without a student link.

A browser-injected HTTP 503 on that exact batch-detail request produced the
bounded error and Retry details action. Removing the injected failure and clicking
Retry details recovered the real persisted row. This is synthetic browser failure
injection, not evidence of an actual API outage. CLI snapshots were recorded at
`.playwright-cli/page-2026-09-09T15-43-21-192Z.yml` and
`.playwright-cli/page-2026-09-09T15-44-05-188Z.yml`.

The existing CSV smoke assertion was updated to the truthful completed/need-review
wording; its touched-file ESLint and diff check passed. The state-changing creation
smoke was not rerun during this follow-up. Confirmed partial-creation links,
multi-page history, support-access changes, and process-loss recovery still need
browser/integration evidence. The validation batch remains as synthetic local
test history; no authoritative student or financial record was deleted.

## Per-row checkpoint hardening

Processed rows now persist immediately with their batch counter increment in one
transaction, before another row starts. Finalization no longer creates the whole
row history after the audit call. A checkpoint failure aborts further processing;
a later audit/finalization failure leaves earlier checkpoints available and the
batch unfinished. The checkpoint batch update explicitly includes tenant scope.

Local admissions unit suite: 42/42 passed, including checkpoint preservation when
the final audit fails and stopping before the next row when row persistence fails.
API TypeScript and diff checks passed. The fault tests use mocked persistence;
they do not prove database crash durability or end-to-end restart recovery.

The admission-core commit and its row checkpoint remain separate transactions.
A crash between them still requires reconciliation through the stable student
operation ID. No automatic resume, stale-worker lease recovery, or permission to
re-import an unfinished batch is claimed by this change.

Follow-up verification: a confirmed-import regression now proves that a failed
checkpoint after the first mocked successful admission prevents a second call to
student creation and does not finalize the batch. The full API Jest run passed
272 suites / 2,998 tests; API TypeScript and diff checks passed. The first package
script invocation ran no tests because its argument separator treated runInBand
as a name filter; the successful command was
`pnpm --filter @schoolos/api exec jest --runInBand` after core build and Prisma
generation. This remains local unit evidence, not live crash/restart proof.

The import review queue now distinguishes loading and failed requests from a
confirmed empty result. Request failures show unavailable/unknown status with a
retry action instead of a healthy zero. All rows in the bounded server response
are displayed rather than silently truncating 25 results to eight; the UI states
the displayed versus total count and directs older-batch review to history.
Web typecheck, touched-component lint, and all 658 web checks passed. The existing
checks do not directly exercise this newly added rendered queue failure branch;
browser fault-injection verification for that branch remains pending.

2026-09-10 follow-up: confirmed-import request failures now invalidate student,
readiness, batch-history, selected-batch, and review-queue queries without replaying
the mutation or discarding the CSV. The generic failure message no longer claims
that rows cannot be hidden or advises an immediate retry. It explicitly states
that the outcome is unknown and requires review/reconciliation before re-import.
All 658 web checks, web TypeScript, touched-component ESLint, and diff checks
passed on the current worktree. This does not add automatic recovery or prove
the new error behavior through a rendered browser test.
