#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lib/schoolos-env.mjs';

const evidenceDir = join(repoRoot, 'docs/production/evidence');
const apiBaseUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public',
      REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
      REDIS_PORT: process.env.REDIS_PORT ?? '6380',
      SMOKE_API_BASE_URL: apiBaseUrl,
    },
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [];

  results.push({ name: 'db:validate', ...run('pnpm', ['db:validate'], true) });
  results.push({ name: 'smoke:pilot', ...run('pnpm', ['smoke:pilot'], true) });
  results.push({
    name: 'verify-def-staging',
    ...run('node', ['scripts/verify-def-staging.mjs'], true),
  });

  const webE2e = run(
    'pnpm',
    ['--filter', '@schoolos/web', 'exec', 'playwright', 'test', 'e2e/public-smoke.spec.ts'],
    true,
  );
  results.push({ name: 'web-e2e-public-smoke', ...webE2e });

  const backup = run('pnpm', ['backup:local'], true);
  results.push({ name: 'backup:local', ...backup });

  const finishedAt = new Date().toISOString();
  const failed = results.filter((result) => !result.ok);
  const evidencePath = join(evidenceDir, 'staging-gates-2026-07-29-local.md');

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    evidencePath,
    `# Staging Gates Evidence (Local Simulation)

- Date: ${finishedAt}
- API base URL: ${apiBaseUrl}
- Result: **${failed.length === 0 ? 'PASS' : 'FAIL'}**

## Gate results

| Gate | Result |
| --- | --- |
${results.map((result) => `| ${result.name} | ${result.ok ? 'PASS' : 'FAIL'} |`).join('\n')}

## Notes

- Requires staging infra from \`pnpm staging:deploy:local\` and a running API (\`pnpm dev\` or container profile).
- Full authenticated Playwright suite should be rerun against TLS staging before GA.
- Started: ${startedAt}
- Finished: ${finishedAt}
`,
    'utf8',
  );

  console.log(`Staging gates evidence written to ${evidencePath}`);

  if (failed.length > 0) {
    for (const result of failed) {
      console.error(`Failed gate: ${result.name}`);
      if (result.stderr) console.error(result.stderr.slice(0, 500));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
