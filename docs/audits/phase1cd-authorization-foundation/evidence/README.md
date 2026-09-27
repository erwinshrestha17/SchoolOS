# Phase 1C / 1D local evidence

Starting SHA: `7c828a39c4548e273a7e3a46c1392768eead1094`. Local commands ran against the working patch and are supplemental to the exact delivery commit's hosted CI, cited in the PR and delivery response. This evidence does not certify deployed readiness.

| Final local check | Observed result |
| --- | --- |
| Root lint / typecheck | PASS; existing API warnings retained; no rule changes |
| Root unit/component tests | Core 12; API 277 suites / 3,219 tests; Web 666; no reported skips |
| Full API HTTP | 45 suites / 318 tests |
| Full opted-in PostgreSQL integration | 13 suites / 222 tests; both guarded URLs supplied; no skipped suites |
| Migration / generation | All 115 migrations deployed to three disposable databases; Prisma generation passes |
| Legacy replay | 112 baseline + 3 new migrations; nine mappings, three retained/audited unresolved grants; corruption rollback and foreign-write rejection |
| History / drift | 112 old SQL files unchanged; no schema difference |
| OpenAPI | 1,152 paths / 1,334 operations / 475 schemas |
| Build / compiled runtime | API + Web production build passes; compiled API health returns 200 on port 4207 |
| Tracked artifacts / diff | PASS |

`results.jsonl` preserves command, status and timing, including preliminary failures. Each compressed log retains the named attempt. Diagnostic interpretation appears in the parent report. `baseline-migrations.json` records unchanged old migration bytes. `prerequisite-full-ci.json` captures the starting SHA's live full CI result. `implementation-sha256.json` identifies the verified implementation bytes. `SHA256SUMS` locks this evidence package; verify from this directory with `shasum -a 256 -c SHA256SUMS`.

Disposable local data and credentials are synthetic. The evidence records no provider, device, staging, pilot or production proof. Browser and Flutter certification comes from the full delivery-SHA hosted workflow, not from the local unit/build checks.
