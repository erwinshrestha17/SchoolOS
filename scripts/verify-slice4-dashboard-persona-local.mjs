#!/usr/bin/env node

/**
 * Slice 4.1 — HTTP validation for GET /dashboard/summary persona projection.
 * Requires a running API (default http://localhost:4000/api/v1) and seeded tenant.
 */
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
  process.env.PILOT_REHEARSAL_PERSONA_PASSWORD ??
  'schoolos-local-demo-only';

const ADMIN_MODULES = [
  'm1_students',
  'm2_attendance',
  'm3_fees',
  'm10_communications',
  'm6_homework_timetable',
  'm7_hr_payroll',
];

const PRINCIPAL_MODULES = [
  'm10_communications',
  'm2_attendance',
  'm4_academics',
  'm3_fees',
  'm7_hr_payroll',
];

const HR_MODULES = ['m7_hr_payroll', 'm10_communications', 'm2_attendance'];

const ACCOUNTANT_MODULES = [
  'm3_fees',
  'm9_accounting',
  'm7_hr_payroll',
  'm10_communications',
];

const FORBIDDEN_TOP_LEVEL = [
  'cashierClose',
  'applicationsNeedingReview',
];

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

function unwrap(body) {
  return body?.data ?? body;
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

function moduleKeys(summary) {
  const modules = summary?.modules ?? [];
  return modules.map((m) => m.module).filter(Boolean);
}

function assertSubset(actual, allowed, label) {
  const extras = actual.filter((key) => !allowed.includes(key));
  record(
    `${label}: no unauthorized module keys`,
    extras.length === 0,
    extras.length ? `unexpected: ${extras.join(', ')}` : `keys: ${actual.join(', ') || '(none visible)'}`,
  );
}

function assertForbiddenFieldsAbsent(summary, label) {
  const found = FORBIDDEN_TOP_LEVEL.filter((key) => key in (summary ?? {}));
  record(
    `${label}: forbidden top-level fields absent`,
    found.length === 0,
    found.length ? `found: ${found.join(', ')}` : 'ok',
  );
}

async function expectDashboardSummary(email, expectations) {
  const { label, expectStatus, expectPersona, allowedModules, forbiddenModules } =
    expectations;
  const loginResult = await login(email);
  if (!loginResult.token) {
    record(`${label}: login`, false, `HTTP ${loginResult.status}`);
    record(`${label}: dashboard summary`, false, 'skipped — login failed');
    return;
  }
  record(`${label}: login`, true, email);

  const dash = await request('/dashboard/summary', {
    headers: authHeaders(loginResult.token),
  });
  const summary = unwrap(dash.body);

  record(
    `${label}: HTTP status`,
    dash.status === expectStatus,
    `HTTP ${dash.status} (expected ${expectStatus})`,
  );

  if (expectStatus !== 200) {
    return;
  }

  record(
    `${label}: compositionPersona`,
    summary?.compositionPersona === expectPersona,
    `got ${summary?.compositionPersona ?? 'undefined'} (expected ${expectPersona})`,
  );

  const keys = moduleKeys(summary);
  if (allowedModules) {
    assertSubset(keys, allowedModules, label);
  }
  if (forbiddenModules?.length) {
    const leaked = forbiddenModules.filter((key) => keys.includes(key));
    record(
      `${label}: excluded modules absent`,
      leaked.length === 0,
      leaked.length ? `leaked: ${leaked.join(', ')}` : 'ok',
    );
  }
  assertForbiddenFieldsAbsent(summary, label);
}

async function inspectOpenApi() {
  const docs = await request('/docs-json');
  if (docs.status !== 200) {
    record('OpenAPI docs-json reachable', false, `HTTP ${docs.status}`);
    return;
  }
  record('OpenAPI docs-json reachable', true, apiBaseUrl.replace(/\/api\/v1$/, '/api/v1/docs-json'));

  const raw = JSON.stringify(docs.body ?? {});
  record(
    'OpenAPI: general persona absent from schema',
    !raw.includes('"general"'),
    raw.includes('"general"') ? 'found "general" in docs-json' : 'no general enum value',
  );

  const hasAdmin = raw.includes('"admin"');
  const hasPrincipal = raw.includes('"principal"');
  const hasHr = raw.includes('"hr"');
  const hasAccountant = raw.includes('"accountant"');
  record(
    'OpenAPI: supported persona values present',
    hasAdmin && hasPrincipal && hasHr && hasAccountant,
    `admin=${hasAdmin} principal=${hasPrincipal} hr=${hasHr} accountant=${hasAccountant}`,
  );

  const dashboardPath = docs.body?.paths?.['/api/v1/dashboard/summary'] ??
    docs.body?.paths?.['/dashboard/summary'];
  const pathJson = dashboardPath ? JSON.stringify(dashboardPath) : '';
  const hasPersonaQuery =
    /"name"\s*:\s*"persona"/.test(pathJson) ||
    /"in"\s*:\s*"query"[^}]*"name"\s*:\s*"persona"/.test(pathJson);
  record(
    'OpenAPI: no persona query param on dashboard summary',
    !hasPersonaQuery,
    hasPersonaQuery ? 'persona query param found' : 'no persona query param',
  );
}

async function main() {
  console.log(`Slice 4 dashboard persona verification — tenant=${tenantSlug} api=${apiBaseUrl}\n`);

  const health = await request('/health');
  record('API health', health.status === 200, `HTTP ${health.status}`);

  await inspectOpenApi();

  await expectDashboardSummary('admin@schoolos.com', {
    label: 'Admin',
    expectStatus: 200,
    expectPersona: 'admin',
    allowedModules: ADMIN_MODULES,
    forbiddenModules: ['m4_academics', 'm9_accounting'],
  });

  await expectDashboardSummary('principal@schoolos.com', {
    label: 'Principal',
    expectStatus: 200,
    expectPersona: 'principal',
    allowedModules: PRINCIPAL_MODULES,
    forbiddenModules: ['m1_students', 'm9_accounting'],
  });

  await expectDashboardSummary('hr@schoolos.com', {
    label: 'HR',
    expectStatus: 200,
    expectPersona: 'hr',
    allowedModules: HR_MODULES,
    forbiddenModules: ['m1_students', 'm4_academics', 'm9_accounting', 'm3_fees'],
  });

  await expectDashboardSummary('accountant@schoolos.com', {
    label: 'Accountant',
    expectStatus: 200,
    expectPersona: 'accountant',
    allowedModules: ACCOUNTANT_MODULES,
    forbiddenModules: ['m1_students', 'm4_academics'],
  });

  await expectDashboardSummary('classteacher@schoolos.com', {
    label: 'Teacher',
    expectStatus: 403,
  });

  await expectDashboardSummary('driver@schoolos.com', {
    label: 'Driver (route guard — not in dashboard @Roles)',
    expectStatus: 403,
  });

  const failed = checks.filter((c) => !c.ok);
  const evidencePath = join(
    evidenceDir,
    `slice4-dashboard-persona-http-${stamp}-local.md`,
  );
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    evidencePath,
    `# Slice 4 Dashboard Persona HTTP Evidence (${stamp}, local)

- Tenant slug: \`${tenantSlug}\`
- API base: \`${apiBaseUrl}\`
- Result: **${failed.length === 0 ? 'PASS' : 'FAIL'}** (${checks.filter((c) => c.ok).length}/${checks.length} checks)

## Checks

| Check | Result | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail.replace(/\|/g, '\\|')} |`).join('\n')}

## Notes

- Run against staging-equivalent API with \`default-school\` seed for full persona matrix.
- Teacher and unsupported operators must return HTTP 403 with no compositionPersona payload.
`,
  );
  console.log(`\nEvidence: ${evidencePath}`);
  console.log(
    `\nResult: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.ok).length}/${checks.length})`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
