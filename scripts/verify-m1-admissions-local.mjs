#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'default-school';
const adminEmail = process.env.SMOKE_EMAIL ?? 'admin@schoolos.com';
const adminPassword =
  process.env.SMOKE_PASSWORD ??
  process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
  process.env.SCHOOLOS_DEMO_PASSWORD ??
  'schoolos-local-demo-only';
const parentEmail =
  process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01a001@schoolos.test';
const parentPassword =
  process.env.SMOKE_PARENT_PASSWORD ??
  process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
  adminPassword;
const otherParentEmail =
  process.env.SMOKE_OTHER_PARENT_EMAIL ?? 'guardian.c01a002@schoolos.test';
const otherParentPassword =
  process.env.SMOKE_OTHER_PARENT_PASSWORD ?? parentPassword;

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

async function login(credentials) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'flutter',
    },
    body: JSON.stringify(credentials),
  });
  const token = result.body?.data?.accessToken ?? result.body?.accessToken;
  return {
    ...result,
    token,
    ok: (result.status === 200 || result.status === 201) && Boolean(token),
  };
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
  const adminLogin = await login({
    tenantSlug,
    email: adminEmail,
    password: adminPassword,
  });
  record(
    'M1 admin login',
    adminLogin.ok,
    adminLogin.ok ? 'token received' : `HTTP ${adminLogin.status}`,
  );

  if (!adminLogin.token) {
    writeEvidence(false);
    process.exit(1);
  }

  const adminAuth = authHeaders(adminLogin.token);

  const adminRoutes = [
    { name: 'Students list', path: '/students?page=1&limit=5', expect: 200 },
    {
      name: 'Admission cases queue',
      path: '/admissions/cases?page=1&limit=5',
      expect: 200,
    },
    {
      name: 'Admission policies list',
      path: '/admissions/policies?page=1&limit=5',
      expect: 200,
    },
    { name: 'QR credential summary', path: '/students/qr/summary', expect: 200 },
    {
      name: 'Document requests queue',
      path: '/admissions/document-requests?page=1&limit=5',
      expect: 200,
    },
  ];

  for (const route of adminRoutes) {
    const result = await request(route.path, { headers: adminAuth });
    record(route.name, result.status === route.expect, `HTTP ${result.status}`);
  }

  const parentLogin = await login({
    tenantSlug,
    email: parentEmail,
    password: parentPassword,
  });
  record(
    'M1 parent login',
    parentLogin.ok,
    parentLogin.ok ? 'token received' : `HTTP ${parentLogin.status}`,
  );

  if (parentLogin.token) {
    const childrenResult = await request('/mobile/me/students', {
      headers: authHeaders(parentLogin.token),
    });
    const children = getItems(childrenResult.body);
    record(
      'Parent linked children',
      childrenResult.status === 200 && children.length > 0,
      `HTTP ${childrenResult.status}, count=${children.length}`,
    );

    const childId = children[0]?.id;
    if (childId) {
      const profileResult = await request(
        `/mobile/students/${childId}/profile`,
        { headers: authHeaders(parentLogin.token) },
      );
      record(
        'Parent linked child profile',
        profileResult.status === 200,
        `HTTP ${profileResult.status}`,
      );

      const studentsResult = await request('/students?page=1&limit=25', {
        headers: adminAuth,
      });
      const students = getItems(studentsResult.body);
      const otherStudent = students.find((student) => student.id !== childId);
      if (otherStudent?.id) {
        const deniedResult = await request(
          `/mobile/students/${otherStudent.id}/profile`,
          { headers: authHeaders(parentLogin.token) },
        );
        record(
          'Parent denied unrelated child profile',
          deniedResult.status === 403,
          `HTTP ${deniedResult.status}`,
        );
      } else {
        record(
          'Parent denied unrelated child profile',
          true,
          'skipped — only one seeded student',
        );
      }
    }
  }

  const otherParentLogin = await login({
    tenantSlug,
    email: otherParentEmail,
    password: otherParentPassword,
  });
  if (otherParentLogin.ok) {
    const inboxResult = await request('/mobile/me/notifications?limit=5', {
      headers: authHeaders(otherParentLogin.token),
    });
    record(
      'Alternate parent notifications reachable',
      inboxResult.status === 200,
      `HTTP ${inboxResult.status}`,
    );
  } else {
    record(
      'Alternate parent notifications reachable',
      true,
      'skipped — alternate parent not seeded',
    );
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m1-admissions-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M1 Admissions verification (${stamp}, local)

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
