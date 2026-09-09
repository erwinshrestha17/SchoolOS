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

  const fixtureEnv = {
    ...process.env,
    NODE_ENV: 'development',
    SCHOOLOS_PILOT_REHEARSAL_FIXTURES: 'true',
  };
  const seedResult = run(
    'pnpm',
    ['--filter', '@schoolos/api', 'db:seed:pilot-rehearsal'],
    { env: fixtureEnv, capture: true },
  );
  const personaResult = run(
    'pnpm',
    ['--filter', '@schoolos/api', 'db:seed:pilot-rehearsal-personas'],
    { env: fixtureEnv, capture: true },
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
SCHOOLOS_PILOT_REHEARSAL_FIXTURES=true pnpm --filter @schoolos/api db:seed:pilot-rehearsal
SCHOOLOS_PILOT_REHEARSAL_FIXTURES=true pnpm --filter @schoolos/api db:seed:pilot-rehearsal-personas
\`\`\`

## Seed output

\`\`\`
${(seedResult.stdout ?? '').trim()}
${(personaResult.stdout ?? '').trim()}
\`\`\`

## Tenant

- Slug: \`pilot-rehearsal-1\`
- Admin: \`admin@pilot-rehearsal.schoolos.test\`
- Credentials: local rehearsal only; never copied into evidence

## Next steps

1. \`pnpm staging:api:local\`
2. \`pnpm verify:pilot-entitlements\`
3. \`pnpm smoke:pilot:rehearsal\` (Wave 1 mode)
`,
    'utf8',
  );

  console.log(`Provision log written to ${evidencePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
