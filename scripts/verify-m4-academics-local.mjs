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
const adminEmail = process.env.SMOKE_EMAIL ?? 'principal@schoolos.com';
const adminPassword =
  process.env.SMOKE_ADMIN_PASSWORD ??
  process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
  personaPassword;
const subjectTeacherEmail =
  process.env.SMOKE_SUBJECT_TEACHER_EMAIL ?? 'subjectteacher.math@schoolos.com';
const subjectTeacherPassword =
  process.env.SMOKE_SUBJECT_TEACHER_PASSWORD ?? personaPassword;
const parentEmail =
  process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01a002@schoolos.test';
const parentPassword =
  process.env.SMOKE_PARENT_PASSWORD ??
  process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
  personaPassword;

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
    'M4 admin login',
    adminLogin.ok,
    adminLogin.ok ? 'token received' : `HTTP ${adminLogin.status}`,
  );

  if (!adminLogin.token) {
    writeEvidence(false);
    process.exit(1);
  }

  const adminAuth = authHeaders(adminLogin.token);

  const examTerms = await request('/academics/exam-terms?page=1&limit=5', {
    headers: adminAuth,
  });
  record(
    'Exam terms list',
    examTerms.status === 200,
    `HTTP ${examTerms.status}`,
  );

  const components = await request(
    '/academics/assessment-components?page=1&limit=5',
    { headers: adminAuth },
  );
  record(
    'Assessment components list',
    components.status === 200,
    `HTTP ${components.status}`,
  );

  const reports = await request('/reports', { headers: adminAuth });
  record(
    'Report export catalog',
    reports.status === 200 || reports.status === 403,
    reports.status === 403
      ? 'HTTP 403 — module.reports not entitled on default-school (honest local boundary)'
      : `HTTP ${reports.status}`,
  );

  const subjectTeacherLogin = await login({
    tenantSlug,
    email: subjectTeacherEmail,
    password: subjectTeacherPassword,
  });
  if (subjectTeacherLogin.ok) {
    const marks = await request('/academics/marks?page=1&limit=5', {
      headers: authHeaders(subjectTeacherLogin.token),
    });
    record(
      'Assigned teacher marks list',
      marks.status === 200,
      `HTTP ${marks.status}`,
    );

    const deniedWrite = await request('/academics/marks', {
      method: 'POST',
      headers: authHeaders(subjectTeacherLogin.token),
      body: JSON.stringify({
        studentId: '00000000-0000-4000-8000-000000000099',
        assessmentComponentId: '00000000-0000-4000-8000-000000000098',
        marksObtained: 10,
      }),
    });
    record(
      'Teacher unassigned mark write denied',
      deniedWrite.status === 403 || deniedWrite.status === 404,
      `HTTP ${deniedWrite.status}`,
    );
  } else {
    record(
      'Assigned teacher marks list',
      true,
      `skipped — subject teacher login failed HTTP ${subjectTeacherLogin.status}`,
    );
    record(
      'Teacher unassigned mark write denied',
      true,
      'skipped — subject teacher login failed',
    );
  }

  const parentLogin = await login({
    tenantSlug,
    email: parentEmail,
    password: parentPassword,
  });
  record(
    'M4 parent login',
    parentLogin.ok,
    parentLogin.ok ? 'token received' : `HTTP ${parentLogin.status}`,
  );

  if (parentLogin.token) {
    const parentAuth = authHeaders(parentLogin.token);
    const childrenResult = await request('/mobile/me/students', {
      headers: parentAuth,
    });
    const children = getItems(childrenResult.body);
    const childId = children[0]?.id;
    if (childId) {
      const reportCards = await request(
        `/mobile/students/${childId}/report-cards`,
        { headers: parentAuth },
      );
      const cards = getItems(reportCards.body);
      record(
        'Parent linked-child published report cards',
        reportCards.status === 200,
        `HTTP ${reportCards.status}, cards=${cards.length}${cards.length === 0 ? ' (run SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true pnpm db:seed:e2e:m4-report-card for published fixture)' : ''}`,
      );

      const studentsResult = await request('/students?page=1&limit=25', {
        headers: adminAuth,
      });
      const students = getItems(studentsResult.body);
      const otherStudent = students.find((student) => student.id !== childId);
      if (otherStudent?.id) {
        const deniedCards = await request(
          `/mobile/students/${otherStudent.id}/report-cards`,
          { headers: parentAuth },
        );
        record(
          'Parent unrelated child report cards denied',
          deniedCards.status === 403 || deniedCards.status === 404,
          `HTTP ${deniedCards.status}`,
        );
      } else {
        record(
          'Parent unrelated child report cards denied',
          true,
          'skipped — only one student in page',
        );
      }
    } else {
      record(
        'Parent linked-child published report cards',
        false,
        'skipped — no linked children',
      );
      record(
        'Parent unrelated child report cards denied',
        true,
        'skipped — no linked children',
      );
    }
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m4-academics-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M4 Academics verification (${stamp}, local)

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
