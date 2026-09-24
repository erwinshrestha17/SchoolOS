# SchoolOS Phase 0 / Slice 0A final implementation evidence

Implementation target: `05f53d8ddd7495b72cc4e09ca2f6528541fd8ebe` on `main`. Every local gate in this folder ran
with that commit checked out and a clean tracked working tree; the JSONL
manifests record command, result, target SHA and post-command cleanliness.
The parent baseline report is the scoped audit decision. These logs are
evidence, not a separate product or implementation authority.

- `results.jsonl`: frozen install, generated/shared contracts, Prisma,
  format/lint/typecheck, API and Web unit tests, API HTTP E2E, PostgreSQL
  integration, schema drift and production builds.
- `database-results.jsonl`, `migration-history.json`: a new PostgreSQL 16
  database received all 112 unchanged migrations, canonical seed, migration
  status and an empty schema diff. No resolve/manual-repair step was used.
- `flutter-results.jsonl`: dependency resolution, format, analyze and all
  device-independent tests, including the ten same-host exact-pixel goldens.
  `golden-provenance.json` records the separate original-source comparison.
- `browser-results.jsonl`: separate Platform and admissions fixtures, a Web
  build with `NEXT_PUBLIC_API_BASE_URL=http://localhost:4400/api/v1` set at
  build time, compiled API runtime, and 33 authenticated Chromium smoke cases.
- `backup-restore-result.json` plus both digest files: isolated local
  PostgreSQL/storage restore with every public table and synthetic file
  compared. This does not certify cloud or staging recovery.
- `hosted-ci.json`, `hosted-verify-job.log.gz` and
  `hosted-dispatch-watch.log.gz`: full manual-dispatch run 35941980611 on the
  same SHA, with both jobs successful, no skipped steps, and 33/33 hosted
  Chromium cases. The canonical live run is
  https://github.com/erwinshrestha17/SchoolOS/actions/runs/35941980611.

Read a log with `gzip -dc NAME.log.gz`. Verify all preserved evidence bytes
with `shasum -a 256 -c SHA256SUMS` from this folder. `hosted-ci.json` and
`hosted-dispatch-watch.log.gz` record the full manual-dispatch CI result for
this implementation SHA. The local and hosted evidence do not imply
real-provider, physical-device, staging or production readiness.
