#!/usr/bin/env node

const apiBaseUrl = (
  process.env.MONITOR_API_BASE_URL ??
  process.env.SMOKE_API_BASE_URL ??
  'http://localhost:4000/api/v1'
).replace(/\/$/, '');
const webhookUrl = process.env.MONITOR_ALERT_WEBHOOK_URL?.trim() ?? '';
const pollIntervalMs = readPositiveInteger('MONITOR_POLL_INTERVAL_MS', 30_000);
const failureThresholdMs = readNonNegativeInteger(
  'MONITOR_FAILURE_THRESHOLD_MS',
  120_000,
);
const requestTimeoutMs = readPositiveInteger(
  'MONITOR_REQUEST_TIMEOUT_MS',
  10_000,
);
const runOnce = process.env.MONITOR_RUN_ONCE === 'true';
const dryRun = process.env.MONITOR_DRY_RUN === 'true';

let stopping = false;
let failureStartedAt = null;
let incidentAlerted = false;

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readNonNegativeInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function validateConfiguration() {
  const apiUrl = new URL(apiBaseUrl);
  const apiIsLocal = ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname);
  if (apiUrl.protocol !== 'https:' && !apiIsLocal) {
    throw new Error('MONITOR_API_BASE_URL must use HTTPS outside localhost.');
  }

  if (!dryRun && !webhookUrl) {
    throw new Error(
      'MONITOR_ALERT_WEBHOOK_URL is required unless MONITOR_DRY_RUN=true.',
    );
  }

  if (webhookUrl) {
    const alertUrl = new URL(webhookUrl);
    const alertIsLocal = ['localhost', '127.0.0.1', '::1'].includes(
      alertUrl.hostname,
    );
    if (alertUrl.protocol !== 'https:' && !alertIsLocal) {
      throw new Error(
        'MONITOR_ALERT_WEBHOOK_URL must use HTTPS outside localhost.',
      );
    }
  }
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
}

async function inspectEndpoint(path) {
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(`${apiBaseUrl}${path}`);
    let status = null;
    try {
      const body = await response.json();
      status = (body?.data ?? body)?.status ?? null;
    } catch {
      // HTTP status is still authoritative when the response is not JSON.
    }
    return {
      path,
      ok: response.status === 200 && (path !== '/ready' || status === 'ready'),
      httpStatus: response.status,
      dependencyStatus: status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      httpStatus: null,
      dependencyStatus: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function inspectSchoolOs() {
  const [health, ready] = await Promise.all([
    inspectEndpoint('/health'),
    inspectEndpoint('/ready'),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    ok: health.ok && ready.ok,
    checks: { health, ready },
  };
}

async function sendAlert(kind, result, failureDurationMs) {
  const payload = {
    service: 'schoolos-api',
    environment: process.env.MONITOR_ENVIRONMENT ?? 'unknown',
    kind,
    occurredAt: new Date().toISOString(),
    apiBaseUrl,
    failureDurationMs,
    checks: result.checks,
  };

  if (dryRun) {
    console.log(`[monitor] dry-run ${kind}: ${JSON.stringify(payload)}`);
    return;
  }

  const response = await fetchWithTimeout(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Alert webhook returned HTTP ${response.status}.`);
  }
}

async function observe() {
  const result = await inspectSchoolOs();
  if (result.ok) {
    console.log(
      `[monitor] ${result.checkedAt} healthy health=200 ready=200`,
    );
    if (incidentAlerted) {
      await sendAlert(
        'schoolos.recovered',
        result,
        Date.now() - failureStartedAt,
      );
      console.log('[monitor] recovery alert delivered.');
    }
    failureStartedAt = null;
    incidentAlerted = false;
    return true;
  }

  failureStartedAt ??= Date.now();
  const failureDurationMs = Date.now() - failureStartedAt;
  const summary = Object.values(result.checks)
    .map(
      (check) =>
        `${check.path}=${check.httpStatus ?? 'unreachable'}${
          check.dependencyStatus ? `/${check.dependencyStatus}` : ''
        }`,
    )
    .join(' ');
  console.error(
    `[monitor] ${result.checkedAt} unhealthy ${summary} duration=${failureDurationMs}ms`,
  );

  if (!incidentAlerted && failureDurationMs >= failureThresholdMs) {
    await sendAlert('schoolos.unhealthy', result, failureDurationMs);
    incidentAlerted = true;
    console.error('[monitor] incident alert delivered.');
  }
  return false;
}

async function waitForNextPoll() {
  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

async function main() {
  validateConfiguration();
  process.on('SIGINT', () => {
    stopping = true;
  });
  process.on('SIGTERM', () => {
    stopping = true;
  });

  do {
    const healthy = await observe();
    if (runOnce) {
      process.exitCode = healthy ? 0 : 1;
      return;
    }
    if (!stopping) await waitForNextPoll();
  } while (!stopping);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
