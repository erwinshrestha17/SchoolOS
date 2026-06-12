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

const target = process.argv[2] ?? 'pilot';
const validTargets = ['pilot', 'core', 'platform', 'learning', 'full'];

if (!validTargets.includes(target)) {
  console.error(`Invalid smoke target: ${target}. Must be one of: ${validTargets.join(', ')}`);
  process.exit(1);
}

const checks = [];

async function main() {
  console.log(`--- Running SchoolOS Smoke Suite: ${target.toUpperCase()} ---`);

  // Connectivity checks (run for all suites)
  checks.push(await checkPostgres());
  checks.push(await checkRedis());
  checks.push(await checkApiEndpoint('API /health', '/health'));
  checks.push(await checkApiEndpoint('API /ready', '/ready'));

  // School admin credentials
  const schoolTenant = process.env.SMOKE_TENANT_SLUG ?? 'default-school';
  const schoolEmail = process.env.SMOKE_EMAIL ?? 'admin@schoolos.com';
  const schoolPassword = process.env.SMOKE_PASSWORD ?? 'admin123';

  // Platform admin credentials
  const platformTenant = process.env.SMOKE_PLATFORM_TENANT_SLUG ?? process.env.PLATFORM_SEED_TENANT_SLUG ?? 'default-school';
  const platformEmail = process.env.SMOKE_PLATFORM_EMAIL ?? process.env.PLATFORM_SEED_EMAIL ?? 'platform@schoolos.com';
  const platformPassword = process.env.SMOKE_PLATFORM_PASSWORD ?? process.env.PLATFORM_SEED_PASSWORD ?? 'platform123';

  let schoolAdminToken = null;
  let platformAdminToken = null;

  // Run suite-specific checks
  if (target === 'pilot' || target === 'core' || target === 'learning' || target === 'full') {
    const loginCheck = await checkSeededLogin('school admin', schoolTenant, schoolEmail, schoolPassword);
    checks.push(loginCheck);
    if (loginCheck.status === 'ok') {
      schoolAdminToken = loginCheck.token;
    }
  }

  if (target === 'platform' || target === 'full') {
    const loginCheck = await checkSeededLogin('platform admin', platformTenant, platformEmail, platformPassword);
    checks.push(loginCheck);
    if (loginCheck.status === 'ok') {
      platformAdminToken = loginCheck.token;
    }
  }

  if ((target === 'platform' || target === 'full') && platformAdminToken) {
    checks.push(await checkAuthApiEndpoint('Platform Health (/platform/health)', '/platform/health', platformAdminToken));
  }

  if ((target === 'learning' || target === 'full') && schoolAdminToken) {
    checks.push(await checkAuthApiEndpoint('Learning Activities (/learning/activities)', '/learning/activities', schoolAdminToken));
  }

  const failed = checks.filter((check) => check.status !== 'ok');

  console.log('');
  for (const check of checks) {
    const prefix = check.status === 'ok' ? 'OK  ' : 'FAIL';
    console.log(`${prefix} ${check.name}${check.message ? ` - ${check.message}` : ''}`);
  }
  console.log('');

  if (failed.length > 0) {
    console.log(`❌ Smoke suite failed with ${failed.length} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Smoke suite completed successfully.`);
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

async function checkApiEndpoint(name, path) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`);
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return { name, status: 'ok' };
  } catch (error) {
    return {
      name,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkSeededLogin(roleName, tenantSlug, email, password) {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'flutter',
      },
      body: JSON.stringify({
        tenantSlug,
        email,
        password,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
    }

    const token = body.data?.accessToken ?? body.accessToken;
    if (!token) {
      throw new Error('Response did not contain accessToken');
    }

    return { name: `Seeded ${roleName} login`, status: 'ok', token };
  } catch (error) {
    return {
      name: `Seeded ${roleName} login`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkAuthApiEndpoint(name, path, token) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'flutter',
      },
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return { name, status: 'ok' };
  } catch (error) {
    return {
      name,
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
