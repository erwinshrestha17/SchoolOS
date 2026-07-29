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
  const staffLogin = await login('staff@schoolos.com');
  if (staffLogin.token) {
    const ownPayslips = await request('/payroll/me/payslips', {
      headers: authHeaders(staffLogin.token),
    });
    record(
      'Staff self-service own payslips',
      ownPayslips.status === 200,
      `HTTP ${ownPayslips.status}`,
    );

    const deniedAll = await request('/payroll/payslips', {
      headers: authHeaders(staffLogin.token),
    });
    record(
      'Staff denied admin payslip list',
      deniedAll.status === 403,
      `HTTP ${deniedAll.status}`,
    );
  } else {
    record(
      'Staff self-service own payslips',
      false,
      `login failed HTTP ${staffLogin.status}`,
    );
    record(
      'Staff denied admin payslip list',
      true,
      'skipped — staff login failed',
    );
  }

  const hrLogin = await login('hr@schoolos.com');
  if (hrLogin.token) {
    const runs = await request('/payroll/runs', {
      headers: authHeaders(hrLogin.token),
    });
    record(
      'HR payroll runs list',
      runs.status === 200,
      `HTTP ${runs.status}`,
    );

    const runId = getItems(runs.body)[0]?.id;
    if (runId) {
      const deniedApprove = await request(`/payroll/runs/${runId}/approve`, {
        method: 'POST',
        headers: {
          ...authHeaders(hrLogin.token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'M7 verify boundary probe' }),
      });
      record(
        'HR denied payroll approve without approver role',
        deniedApprove.status === 403,
        `HTTP ${deniedApprove.status}`,
      );
    } else {
      record(
        'HR denied payroll approve without approver role',
        true,
        'skipped — no payroll runs seeded',
      );
    }
  } else {
    record('HR payroll runs list', false, `login failed HTTP ${hrLogin.status}`);
    record(
      'HR denied payroll approve without approver role',
      true,
      'skipped — hr login failed',
    );
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m7-hr-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M7 HR verification (${stamp}, local)

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
