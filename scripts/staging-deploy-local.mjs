#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { repoRoot } from './lib/schoolos-env.mjs';

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
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    process.env[key] = value;
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log('Starting local staging infrastructure (postgres + redis)...');
  run('docker', [
    'compose',
    '-p',
    'schoolos-staging',
    '-f',
    'docker-compose.staging.yml',
    'up',
    '-d',
    'postgres',
    'redis',
  ]);

  copyFileSync(localStagingEnv, apiEnvPath);
  loadEnvIntoProcess(apiEnvPath);

  console.log('Waiting for staging Postgres health...');
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = spawnSync(
      'docker',
      ['exec', 'schoolos_staging_postgres', 'pg_isready', '-U', 'schoolos', '-d', 'schoolos_staging'],
      { encoding: 'utf8' },
    );
    if (probe.status === 0) break;
    await sleep(1000);
  }

  console.log('Applying migrations and seed to staging database...');
  run('pnpm', ['db:generate'], { env: process.env });
  run('pnpm', ['--filter', '@schoolos/api', 'exec', 'prisma', 'migrate', 'deploy'], {
    env: process.env,
  });
  run('pnpm', ['db:seed'], {
    env: { ...process.env, NODE_ENV: 'development' },
  });
  run('pnpm', ['--filter', '@schoolos/api', 'db:backfill:teacher-assignments'], {
    env: process.env,
  });
  run('pnpm', ['--filter', '@schoolos/api', 'db:backfill:guardian-capabilities'], {
    env: process.env,
  });
  run('pnpm', ['--filter', '@schoolos/api', 'db:enable:staging-learning'], {
    env: process.env,
  });

  const finishedAt = new Date().toISOString();
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, 'staging-deploy-2026-07-29-local.md');
  writeFileSync(
    evidencePath,
    `# Staging Deploy Evidence (Local Simulation)

- Date: ${finishedAt}
- Environment: local-staging (docker-compose.staging.yml postgres/redis on ports 5434/6380)
- Result: **PASS**

## Infrastructure

- Postgres: \`schoolos_staging\` on localhost:5434
- Redis: localhost:6380
- API env file generated: \`apps/api/.env.staging-local\` (gitignored pattern — do not commit secrets)

## Commands executed

\`\`\`bash
docker compose -f docker-compose.staging.yml -p schoolos-staging up -d postgres redis
pnpm db:generate
pnpm --filter @schoolos/api exec prisma migrate deploy
pnpm db:seed
\`\`\`

## Notes

- Full TLS staging preflight (\`pnpm verify:env:staging\`) requires HTTPS origins on the target host.
- Containerized API/web deploy: \`docker compose -f docker-compose.staging.yml --profile app up -d --build\`
- Rehearsal started: ${startedAt}
- Rehearsal finished: ${finishedAt}
`,
    'utf8',
  );

  console.log(`Staging deploy evidence written to ${evidencePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
