#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { repoRoot } from './lib/schoolos-env.mjs';

const apiBaseUrl = (
  process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/$/, '');
const redisContainer =
  process.env.SCHOOLOS_LOCAL_STAGING_REDIS_CONTAINER ??
  'schoolos_staging_redis';
const evidenceDir = join(repoRoot, 'docs', 'production', 'evidence');
const events = [];

function assertLocalTargets() {
  const url = new URL(apiBaseUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(
      `Refusing to rehearse a dependency failure against non-local API ${url.hostname}.`,
    );
  }
  if (!/^schoolos_staging_[a-z0-9_-]+$/.test(redisContainer)) {
    throw new Error(
      'Redis container must be an explicit schoolos_staging_* container.',
    );
  }
}

function docker(args) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `docker ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
  return result.stdout.trim();
}

async function readReady() {
  try {
    const response = await fetch(`${apiBaseUrl}/ready`, {
      signal: AbortSignal.timeout(3000),
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return {
      status: response.status,
      dependencyStatus: body?.data?.status ?? body?.status ?? 'unknown',
    };
  } catch (error) {
    return {
      status: 0,
      dependencyStatus: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForStatus(expectedStatus, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latest = await readReady();
  while (latest.status !== expectedStatus && Date.now() < deadline) {
    await sleep(500);
    latest = await readReady();
  }
  events.push({ expectedStatus, ...latest });
  if (latest.status !== expectedStatus) {
    throw new Error(
      `Expected /ready HTTP ${expectedStatus}, received ${latest.status} (${latest.dependencyStatus}).`,
    );
  }
  return latest;
}

function writeEvidence({ passed, startedAt, finishedAt, error }) {
  mkdirSync(evidenceDir, { recursive: true });
  const stamp = finishedAt.slice(0, 10);
  const evidencePath = join(
    evidenceDir,
    `readiness-dependency-failure-${stamp}-local.md`,
  );
  writeFileSync(
    evidencePath,
    `# Readiness Dependency-Failure Rehearsal (${stamp}, local)

- Started: ${startedAt}
- Finished: ${finishedAt}
- API: ${apiBaseUrl}
- Dependency interrupted: Redis container \`${redisContainer}\`
- Result: **${passed ? 'PASS' : 'FAIL'}**

| Phase | Expected HTTP | Observed HTTP | Reported status |
| --- | ---: | ---: | --- |
${events
  .map(
    (event, index) =>
      `| ${['Initial readiness', 'Redis unavailable', 'Redis restored'][index] ?? `Check ${index + 1}`} | ${event.expectedStatus} | ${event.status} | ${event.dependencyStatus} |`,
  )
  .join('\n')}

${error ? `Failure: ${error}\n\n` : ''}## Evidence boundary

This proves local fail-closed readiness behavior and recovery only. Repeat through the production monitoring path on TLS staging before release approval.
`,
    'utf8',
  );
  return evidencePath;
}

async function main() {
  assertLocalTargets();
  const startedAt = new Date().toISOString();
  let stopped = false;
  let error = null;

  try {
    const running = docker([
      'inspect',
      '--format',
      '{{.State.Running}}',
      redisContainer,
    ]);
    if (running !== 'true') {
      throw new Error(`Redis container ${redisContainer} is not running.`);
    }

    await waitForStatus(200, 5000);
    docker(['stop', redisContainer]);
    stopped = true;
    await waitForStatus(503, 20000);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    if (stopped) {
      try {
        docker(['start', redisContainer]);
        await waitForStatus(200, 30000);
      } catch (caught) {
        const restoreError = caught instanceof Error ? caught.message : String(caught);
        error = error ? `${error}; restore failed: ${restoreError}` : restoreError;
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const evidencePath = writeEvidence({
    passed: error === null && events.length === 3,
    startedAt,
    finishedAt,
    error,
  });
  console.log(`Evidence written to ${evidencePath}`);
  if (error || events.length !== 3) {
    throw new Error(error ?? 'Readiness rehearsal did not complete all phases.');
  }
  console.log('Readiness dependency-failure rehearsal passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
