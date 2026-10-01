#!/usr/bin/env node

const apiBaseUrl = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

async function check(path, expectReady) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const payload = body?.data ?? body;
  return { path, status: response.status, payload };
}

async function main() {
  const health = await check('/health', true);
  const ready = await check('/ready', true);

  console.log(`GET /health -> ${health.status}`);
  console.log(`GET /ready -> ${ready.status} (${ready.payload?.status ?? 'unknown'})`);

  if (health.status !== 200) {
    console.error('Health check failed.');
    process.exit(1);
  }

  if (ready.status !== 200) {
    console.error('Readiness check failed closed as expected when dependencies are unavailable.');
    process.exit(1);
  }

  console.log('Staging health checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
