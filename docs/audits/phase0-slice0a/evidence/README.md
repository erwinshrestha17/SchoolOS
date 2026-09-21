# Evidence lock and reproduction

This directory records the 2026-09-21 local audit. Read `../BASELINE_CERTIFICATION.md` for scope and limitations. It is not a replacement build system or a green certificate.

## Reading the record

- Log names in the report are stored here with `.gz` appended. Read with `gzip -dc <file.log.gz>`.
- `final-results.jsonl` records commands, exit codes and the implementation SHA `3aa8d07cf5a2945bab7f353f0e3ac0620cc2d09c`. Failed connection attempts remain beside successful retries.
- `results.jsonl` describes preliminary runs, including their working-tree changes. Other repair/browser/Flutter logs are explicitly named; they are not all final-SHA reruns. Their relevant source was unchanged by the second repair commit, but that is not a hosted final-SHA certification.
- `starting-ci.log.gz` is the failed hosted run for starting SHA `6240ed7fc62c65a7d10f3fb851a775db8ebefe2a`.
- `historical-harnesses/` preserves the exact local command/environment harnesses and inventory extraction used. They contain developer-machine paths and deliberately synthetic local credentials. They are historical evidence, not commands to run unchanged against another environment. In particular, the browser harness supplied Platform credentials without a corresponding bootstrap; that failure is retained, not endorsed as correct setup.
- `browser-contexts/` contains compressed (`.md.gz`) Playwright failure snapshots of synthetic local fixtures. `golden-sample/` retains the visually inspected homework filter comparison. The other ten-test failure details remain in the Flutter log; no golden was regenerated.
- `SHA256SUMS` hashes the preserved evidence bytes (including this README); verify from this directory using `shasum -a 256 -c SHA256SUMS`.

## Reproduce safely

Use Node 22, pnpm 10.12.1, PostgreSQL 16, Redis 7 and Flutter 3.44.0 / Dart 3.12.0. Use disposable loopback services and synthetic fixture values only. Do not point migration, seed, fixture cleanup or integration commands at a development or production school database.

1. Check out the implementation SHA above in a separate checkout. Read its `AGENTS.md`, five-document authority set, package scripts and `.github/workflows/ci.yml`. Record versions and Git status.
2. Provision an empty PostgreSQL database and a Redis instance. The audited local ports were PostgreSQL 55433 and Redis 56379. Copy environment variable names from the historical harness or CI, using fresh local-only values. Never reuse production secrets.
3. Run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:validate`, `pnpm verify:tracked-artifacts`, `pnpm verify:env:deploy`, `pnpm verify:openapi`, `pnpm lint`, `pnpm --filter @schoolos/api lint:check`, `pnpm --filter @schoolos/core lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`. Run sequentially where generated core/Prisma artifacts are shared. Preserve each command's exit status; do not stop recording after the first failure.
4. Against the empty disposable database run `pnpm db:migrate`, `pnpm db:seed` and `pnpm --filter @schoolos/api exec prisma migrate status`. Capture schema drift separately with `pnpm --filter @schoolos/api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. A zero exit means the diff command ran; nonempty SQL is not a no-drift PASS. Do not apply the diff as a repair.
5. Create and migrate the additional loopback databases named exactly `schoolos_auth_recovery_test` and `schoolos_admission_atomic_test`; provide their URLs through `SCHOOLOS_AUTH_TEST_DATABASE_URL` and `SCHOOLOS_ADMISSION_TEST_DATABASE_URL`. Run `pnpm test:integration` and verify there are no opted-out/skipped suites. These suites intentionally mutate isolated fixtures. CI changes preserve the same explicit opt-in boundary.
6. Build/start the compiled API using synthetic fixtures, and verify its health endpoint. For Web smoke, use the repository Playwright production runner, correctly configured school credentials, and explicit Platform bootstrap where Platform scenarios are required. The ordinary school seed does not create an operator. Run `pnpm --filter @schoolos/web exec playwright install chromium`, then `pnpm test:web:e2e`. Preserve failure artifacts and skipped counts; do not bypass auth rate policy to claim success.
7. In `apps/schoolos_mobile`, run `flutter pub get`, `dart format --output=none --set-exit-if-changed lib test`, `flutter analyze`, and `flutter test`, serially. Review failed image comparisons before changing any baseline. Linux CI's golden exclusion does not replace a full supported-platform golden run.
8. Supplementary formatting was checked with API's installed Prettier over `../../packages/core/src/**/*.ts` and `../../apps/web/{app,components,lib,test}/**/*.{ts,tsx,mjs}`. Neither surface had a canonical whole-surface formatting script; do not silently introduce a bulk formatting policy.
9. After API/core build, run `node docs/audits/phase0-slice0a/probe-authorization.cjs` from the evidence commit checkout. These three synthetic control-flow probes use no live provider, real protected records, or queue delivery and deliberately stop before export artifact writes.

A subsequent successful run must produce its own exact SHA, environment, complete gate outcomes and evidence. These logs cannot be reused as proof that a later checkout is green. The newly enabled manual CI dispatch has not been executed for the local repair commits.
