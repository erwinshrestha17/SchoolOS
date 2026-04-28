#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const requireApiDependency = createRequire(resolve(root, 'apps/api/package.json'));
const { Client: PgClient } = requireApiDependency('pg');
const Redis = requireApiDependency('ioredis');

loadEnvFile(resolve(root, 'apps/api/.env'));

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public';
const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const shouldCheckApi = process.env.SMOKE_SKIP_API !== 'true';
const shouldCheckLogin = process.env.SMOKE_LOGIN === 'true';

const checks = [];

async function main() {
  checks.push(await checkPostgres());
  checks.push(await checkRedis());

  if (shouldCheckApi) {
    checks.push(await checkApiEndpoint('/health'));
    checks.push(await checkApiEndpoint('/ready'));
  }

  if (shouldCheckApi && shouldCheckLogin) {
    checks.push(await checkSeededLogin());
  }

  const failed = checks.filter((check) => check.status !== 'ok');

  for (const check of checks) {
    const prefix = check.status === 'ok' ? 'OK' : 'FAIL';
    console.log(`${prefix} ${check.name}${check.message ? ` - ${check.message}` : ''}`);
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function checkPostgres() {
  const client = new PgClient({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { name: 'Postgres connectivity', status: 'ok' };
  } catch (error) {
    return {
      name: 'Postgres connectivity',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkRedis() {
  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => undefined);

  try {
    await redis.connect();
    const response = await redis.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${response}`);
    }

    return { name: 'Redis connectivity', status: 'ok' };
  } catch (error) {
    return {
      name: 'Redis connectivity',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function checkApiEndpoint(path) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`);
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return { name: `API ${path}`, status: 'ok' };
  } catch (error) {
    return {
      name: `API ${path}`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkSeededLogin() {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: process.env.SMOKE_TENANT_SLUG ?? 'default-school',
        email: process.env.SMOKE_EMAIL ?? 'admin@schoolos.com',
        password: process.env.SMOKE_PASSWORD ?? 'admin123',
      }),
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return { name: 'Seeded admin login', status: 'ok' };
  } catch (error) {
    return {
      name: 'Seeded admin login',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

await main();
