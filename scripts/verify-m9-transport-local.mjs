#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'default-school';
const personaPassword =
  process.env.SMOKE_PASSWORD ??
  process.env.SCHOOLOS_DEMO_PASSWORD ??
  'schoolos-local-demo-only';

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

async function login(email) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flutter',
    },
    body: JSON.stringify({ tenantSlug, email, password: personaPassword }),
  });
  const token = result.body?.data?.accessToken ?? result.body?.accessToken;
  return { ...result, token };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'flutter',
  };
}

function getItems(body) {
  const data = body?.data ?? body;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

async function main() {
  const driverLogin = await login('driver@schoolos.com');
  if (driverLogin.token) {
    const assignments = await request('/transport/driver/assignments', {
      headers: authHeaders(driverLogin.token),
    });
    record(
      'Driver assigned trips list',
      assignments.status === 200,
      `HTTP ${assignments.status}`,
    );
  } else {
    record(
      'Driver assigned trips list',
      false,
      `login failed HTTP ${driverLogin.status}`,
    );
  }

  const parentLogin = await login('guardian.c01a001@schoolos.test');
  if (parentLogin.token) {
    const parentAuth = authHeaders(parentLogin.token);
    const children = getItems(
      (await request('/mobile/me/students', { headers: parentAuth })).body,
    );
    const childId = children[0]?.id;
    if (childId) {
      const status = await request(
        `/transport/parent/students/${childId}/status`,
        { headers: parentAuth },
      );
      record(
        'Parent linked-child transport status',
        status.status === 200,
        `HTTP ${status.status}`,
      );
    } else {
      record(
        'Parent linked-child transport status',
        false,
        'skipped — no linked children',
      );
    }
  } else {
    record(
      'Parent linked-child transport status',
      false,
      `login failed HTTP ${parentLogin.status}`,
    );
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m9-transport-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M9 Transport verification (${stamp}, local)

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
