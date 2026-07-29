#!/usr/bin/env node
// DEF-02/DEF-04 attendance homeroom scope: use `pnpm verify:m2-attendance`.

import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

loadEnvFile(join(repoRoot, 'apps/api/.env.staging-local'));
loadEnvFile(join(repoRoot, 'apps/api/.env'));

const checks = [];

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

async function main() {
  const unauthRegister = await request('/tenants/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Evil School',
      slug: 'evil-school',
      adminEmail: 'evil@example.com',
      adminPassword: 'Password123!',
    }),
  });
  record(
    'DEF-01 unauthenticated tenant register denied',
    unauthRegister.status === 401 || unauthRegister.status === 403,
    `HTTP ${unauthRegister.status}`,
  );

  const ready = await request('/ready');
  record(
    'Readiness endpoint reachable',
    ready.status === 200 || ready.status === 503,
    `HTTP ${ready.status}`,
  );

  const readyData = ready.body?.data ?? ready.body;
  if (ready.status === 503) {
    record(
      'Readiness fail-closed when degraded',
      readyData?.status === 'degraded',
      '503 with degraded status',
    );
  } else {
    record(
      'Readiness healthy on staging stack',
      readyData?.status === 'ready',
      readyData?.status ?? 'unknown',
    );
  }

  const teacherLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'flutter' },
    body: JSON.stringify({
      tenantSlug: process.env.SMOKE_TENANT_SLUG ?? 'default-school',
      email: process.env.SMOKE_SUBJECT_TEACHER_EMAIL ?? 'subjectteacher.math@schoolos.com',
      password:
        process.env.SMOKE_SUBJECT_TEACHER_PASSWORD ??
        process.env.SCHOOLOS_DEMO_PASSWORD ??
        'schoolos-local-demo-only',
    }),
  });

  const token = teacherLogin.body?.data?.accessToken ?? teacherLogin.body?.accessToken;
  record('Teacher auth for scope checks', Boolean(token), `HTTP ${teacherLogin.status}`);

  if (token) {
    const assignments = await request('/teacher-workspace/assignments', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'flutter' },
    });
    record(
      'DEF-06 teacher-workspace assignments reachable when entitled',
      assignments.status === 200,
      `HTTP ${assignments.status}`,
    );
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`DEF staging verification failed (${failed.length}/${checks.length}).`);
    process.exit(1);
  }

  console.log(`DEF staging verification passed (${checks.length}/${checks.length}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
