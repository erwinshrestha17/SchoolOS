#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const evidenceDir = join(repoRoot, 'docs/production/evidence');
const localStagingEnv = join(repoRoot, 'deploy/env.local-staging.example');
const apiEnvPath = join(repoRoot, 'apps/api/.env.staging-local');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}${result.stderr ? `\n${result.stderr}` : ''}`,
    );
  }
  return result;
}

function loadEnvIntoProcess(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log('Provisioning controlled-pilot rehearsal tenant...');

  if (existsSync(localStagingEnv)) {
    copyFileSync(localStagingEnv, apiEnvPath);
    loadEnvIntoProcess(apiEnvPath);
  }
  loadEnvFile(join(repoRoot, 'apps/api/.env.staging-local'));

  run('pnpm', ['db:seed:platform'], { env: process.env });
  const seedResult = run(
    'pnpm',
    ['--filter', '@schoolos/api', 'db:seed:pilot-rehearsal'],
    { env: process.env, capture: true },
  );

  const finishedAt = new Date().toISOString();
  const evidencePath = join(
    evidenceDir,
    'controlled-pilot-pilot-rehearsal-1-provision-log.md',
  );
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    evidencePath,
    `# Pilot Rehearsal Provision Log

- Started: ${startedAt}
- Finished: ${finishedAt}
- Result: **PASS**

## Commands

\`\`\`bash
pnpm db:seed:platform
pnpm --filter @schoolos/api db:seed:pilot-rehearsal
\`\`\`

## Seed output

\`\`\`
${(seedResult.stdout ?? '').trim()}
\`\`\`

## Tenant

- Slug: \`pilot-rehearsal-1\`
- Admin: \`admin@pilot-rehearsal.schoolos.test\`
- Password: set via \`PILOT_REHEARSAL_ADMIN_PASSWORD\` or seed default (see stdout once)

## Next steps

1. \`pnpm staging:api:local\`
2. \`pnpm seed:pilot-rehearsal-personas\`
3. \`pnpm verify:pilot-entitlements\`
4. \`pnpm smoke:pilot:rehearsal\` (Wave 1 mode — after persona seed)
`,
    'utf8',
  );

  console.log(`Provision log written to ${evidencePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
