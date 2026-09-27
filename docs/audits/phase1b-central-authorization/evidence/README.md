# SchoolOS Phase 1B local evidence

Starting SHA: `4519f34ca48ddbfdedcd85c3d9723ba17c1da76b`. Local commands ran against the uncommitted Phase 1B patch; they are supplemental evidence, not a substitute for the exact final delivery SHA's full hosted CI. The scoped parent report defines the implemented boundary.

- `results.jsonl` preserves each command, exit code, starting SHA and explicit uncommitted-patch label.
- `*.log.gz` preserve final named command attempts, including full unit/HTTP/PostgreSQL suites, production build and 33-case browser smoke.
- `implementation-file-digests.json` binds the tested API implementation/tests and unchanged Core authorization contracts to SHA-256.
- `migration-history.json` proves all 112 SQL files remain byte-identical to the starting SHA; three empty disposable databases replayed them without manual repair, and schema drift was empty.
- `runtime-health.json` and `api-runtime.log.gz` prove the compiled API served the isolated browser run on port 4401. Its task-owned process was stopped after the run.
- `versions.json` records pnpm/Prisma/PostgreSQL/Redis; `versions.log.gz` records Node 22.23.2.
- `diagnostic-history.md` explains preliminary fixture failures. Named raw logs were overwritten on rerun; the failed manifest entries remain.

Verify evidence with `shasum -a 256 -c SHA256SUMS` here. Read a log with `gzip -dc NAME.log.gz`. Full environment/credential dumps are intentionally excluded. All database/account/provider data used for local checks is synthetic and disposable. Physical-device, provider, staging and production readiness are not claimed. Final hosted CI evidence is referenced in the delivery response.
