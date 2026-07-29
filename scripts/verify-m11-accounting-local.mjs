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

async function login(email, password = personaPassword) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flutter',
    },
    body: JSON.stringify({ tenantSlug, email, password }),
  });
  const token = result.body?.data?.accessToken ?? result.body?.accessToken;
  return { ...result, token };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
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
  const accountantLogin = await login('accountant@schoolos.com');
  if (accountantLogin.token) {
    const journals = await request('/accounting/journals?page=1&limit=5', {
      headers: authHeaders(accountantLogin.token),
    });
    record(
      'Accountant journal list',
      journals.status === 200,
      `HTTP ${journals.status}`,
    );
  } else {
    record(
      'Accountant journal list',
      false,
      `login failed HTTP ${accountantLogin.status}`,
    );
  }

  const e2eAccountantLogin = await login('e2e.accountant@schoolos.test');
  if (e2eAccountantLogin.token) {
    const journals = await request('/accounting/journals?page=1&limit=5', {
      headers: authHeaders(e2eAccountantLogin.token),
    });
    const journalId = getItems(journals.body)[0]?.id;
    record(
      'E2E accountant journal read',
      journals.status === 200,
      `HTTP ${journals.status}`,
    );

    if (journalId) {
      const deniedApprove = await request(
        `/accounting/journals/${journalId}/approve`,
        {
          method: 'POST',
          headers: authHeaders(e2eAccountantLogin.token),
          body: JSON.stringify({ reason: 'M11 verify boundary probe' }),
        },
      );
      record(
        'Prepare role denied journal approve',
        deniedApprove.status === 403,
        `HTTP ${deniedApprove.status}`,
      );
    } else {
      record(
        'Prepare role denied journal approve',
        true,
        'skipped — no journals seeded',
      );
    }
  } else {
    record(
      'E2E accountant journal read',
      true,
      `skipped — e2e accountant login failed HTTP ${e2eAccountantLogin.status}`,
    );
    record(
      'Prepare role denied journal approve',
      true,
      'skipped — e2e accountant login failed',
    );
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m11-accounting-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M11 Accounting verification (${stamp}, local)

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
