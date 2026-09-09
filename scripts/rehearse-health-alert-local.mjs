#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { repoRoot } from './lib/schoolos-env.mjs';

const evidencePath = join(
  repoRoot,
  'docs/production/evidence/monitoring-alert-rehearsal-2026-09-09-local.md',
);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function main() {
  let ready = true;
  let monitor = null;
  let startedDegradation = false;
  const alerts = [];
  const monitorOutput = [];
  let resolveRecovery;
  let rejectRecovery;
  const recoveryReceived = new Promise((resolve, reject) => {
    resolveRecovery = resolve;
    rejectRecovery = reject;
  });

  const apiServer = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/api/v1/health') {
      response.writeHead(200);
      response.end(JSON.stringify({ data: { status: 'ok' } }));
      return;
    }
    if (request.url === '/api/v1/ready') {
      response.writeHead(ready ? 200 : 503);
      response.end(
        JSON.stringify({ data: { status: ready ? 'ready' : 'degraded' } }),
      );
      return;
    }
    response.writeHead(404);
    response.end(JSON.stringify({ error: 'not found' }));
  });

  const webhookServer = createServer((request, response) => {
    if (request.method !== 'POST') {
      response.writeHead(405);
      response.end();
      return;
    }
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        alerts.push(payload.kind);
        if (payload.kind === 'schoolos.unhealthy') ready = true;
        if (payload.kind === 'schoolos.recovered') resolveRecovery();
        response.writeHead(204);
        response.end();
      } catch (error) {
        response.writeHead(400);
        response.end();
        rejectRecovery(error);
      }
    });
  });

  const [apiPort, webhookPort] = await Promise.all([
    listen(apiServer),
    listen(webhookServer),
  ]);

  try {
    monitor = spawn('node', ['scripts/monitor-schoolos-health.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        MONITOR_API_BASE_URL: `http://127.0.0.1:${apiPort}/api/v1`,
        MONITOR_ALERT_WEBHOOK_URL: `http://127.0.0.1:${webhookPort}/alerts`,
        MONITOR_ENVIRONMENT: 'local-rehearsal',
        MONITOR_POLL_INTERVAL_MS: '100',
        MONITOR_FAILURE_THRESHOLD_MS: '150',
        MONITOR_REQUEST_TIMEOUT_MS: '1000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleOutput = (chunk) => {
      const text = chunk.toString('utf8');
      monitorOutput.push(text.trim());
      if (!startedDegradation && text.includes('healthy health=200 ready=200')) {
        startedDegradation = true;
        ready = false;
      }
    };
    monitor.stdout.on('data', handleOutput);
    monitor.stderr.on('data', handleOutput);

    const timeout = setTimeout(
      () => rejectRecovery(new Error('Timed out waiting for recovery alert.')),
      10_000,
    );
    await recoveryReceived;
    clearTimeout(timeout);

    if (
      alerts.join(',') !== 'schoolos.unhealthy,schoolos.recovered' ||
      !monitorOutput.some((line) => line.includes('/ready=503/degraded'))
    ) {
      throw new Error(
        `Unexpected monitor result: alerts=${alerts.join(',') || 'none'}`,
      );
    }

    await mkdir(join(repoRoot, 'docs/production/evidence'), {
      recursive: true,
    });
    await writeFile(
      evidencePath,
      `# Monitoring alert rehearsal (2026-09-09, local)\n\n` +
        `Status: PASS\n\n` +
        `- Monitor observed an initial healthy state.\n` +
        `- Mock readiness changed to HTTP 503 with \`degraded\` status for longer than the configured rehearsal threshold.\n` +
        `- Monitor delivered one \`schoolos.unhealthy\` webhook.\n` +
        `- After dependency recovery, monitor delivered one \`schoolos.recovered\` webhook.\n` +
        `- Webhook order: ${alerts.join(' -> ')}.\n\n` +
        `This proves transition and payload delivery against local mock endpoints only. Configure and rehearse the real alert destination and hosting metrics on TLS staging before release approval.\n`,
      'utf8',
    );

    console.log(`PASS monitoring alert rehearsal: ${alerts.join(' -> ')}`);
    console.log(`Evidence written to ${evidencePath}`);
  } finally {
    monitor?.kill('SIGTERM');
    await Promise.all([close(apiServer), close(webhookServer)]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
