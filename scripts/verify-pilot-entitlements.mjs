#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const tenantSlug = process.env.PILOT_REHEARSAL_TENANT_SLUG ?? 'pilot-rehearsal-1';
const adminEmail =
  process.env.PILOT_REHEARSAL_ADMIN_EMAIL ?? 'admin@pilot-rehearsal.schoolos.test';
const adminPassword =
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ??
  process.env.SMOKE_PASSWORD ??
  'PilotRehearsal1!';

loadEnvFile(join(repoRoot, 'apps/api/.env.staging-local'));
loadEnvFile(join(repoRoot, 'apps/api/.env'));

const checks = [];
const evidenceDir = join(repoRoot, 'docs/production/evidence');
const stamp = new Date().toISOString().slice(0, 10);

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body, text };
}

function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login() {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flutter',
    },
    body: JSON.stringify({
      tenantSlug,
      email: adminEmail,
      password: adminPassword,
    }),
  });
  const token = result.body?.data?.accessToken ?? result.body?.accessToken;
  const ok = (result.status === 200 || result.status === 201) && Boolean(token);
  return { ...result, token, ok };
}

async function main() {
  const loginResult = await login();
  record(
    'Pilot admin login',
    loginResult.ok,
    loginResult.ok ? 'token received' : `HTTP ${loginResult.status}`,
  );

  if (!loginResult.token) {
    writeEvidence(false);
    process.exit(1);
  }

  const authHeaders = {
    Authorization: `Bearer ${loginResult.token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'flutter',
  };

  const wave1Routes = [
    { name: 'Wave1 students list', path: '/students?page=1&limit=5', expect: 200 },
    { name: 'Wave1 notices list', path: '/notices?page=1&limit=5', expect: 200 },
    { name: 'Wave1 homework list', path: '/homework?page=1&limit=5', expect: 200 },
  ];

  for (const route of wave1Routes) {
    const result = await request(route.path, { headers: authHeaders });
    record(route.name, result.status === route.expect, `HTTP ${result.status}`);
  }

  const gatedRoutes = [
    { name: 'Wave2 fees denied', path: '/fees/invoices?page=1&limit=5', expect: 403 },
    { name: 'Wave3 exams denied', path: '/academics/exam-terms', expect: 403 },
    { name: 'Wave5 learning denied', path: '/learning/activities', expect: 403 },
    { name: 'Wave4 library denied', path: '/library/books?page=1&limit=5', expect: 403 },
  ];

  for (const route of gatedRoutes) {
    const result = await request(route.path, { headers: authHeaders });
    record(route.name, result.status === route.expect, `HTTP ${result.status}`);
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `pilot-entitlements-${tenantSlug}-${stamp}.md`);
  writeFileSync(
    path,
    `# Pilot entitlement verification (${stamp})

- Tenant slug: \`${tenantSlug}\`
- API: ${apiBaseUrl}
- Result: **${passed ? 'PASS' : 'FAIL'}**

| Check | Result | Detail |
|---|---|---|
${checks.map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`).join('\n')}
`,
    'utf8',
  );
  console.log(`Evidence written to ${path}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
