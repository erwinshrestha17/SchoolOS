#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'pilot-rehearsal-1';
const personaPassword =
  process.env.SMOKE_PASSWORD ??
  process.env.PILOT_REHEARSAL_PERSONA_PASSWORD ??
  'PilotRehearsal1!';
const classTeacherEmail =
  process.env.SMOKE_CLASS_TEACHER_EMAIL ?? 'classteacher.1a@schoolos.com';
const subjectTeacherEmail =
  process.env.SMOKE_SUBJECT_TEACHER_EMAIL ?? 'subjectteacher.math@schoolos.com';
const parentEmail =
  process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01a001@schoolos.test';

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
    body: JSON.stringify({
      tenantSlug,
      email,
      password: personaPassword,
    }),
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

function queryPath(path, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function main() {
  const classTeacherLogin = await login(classTeacherEmail);
  record(
    'M6 class teacher login',
    classTeacherLogin.token,
    classTeacherLogin.token ? 'token received' : `HTTP ${classTeacherLogin.status}`,
  );

  if (classTeacherLogin.token) {
    const scopesResult = await request('/mobile/teacher/homework/scopes', {
      headers: authHeaders(classTeacherLogin.token),
    });
    const scopes = getItems(scopesResult.body);
    record(
      'Class teacher homework scopes',
      scopesResult.status === 200,
      `HTTP ${scopesResult.status}, count=${scopes.length}`,
    );

    const scope = scopes[0];
    if (scope?.classId && scope?.sectionId && scope?.subjectId) {
      const homeworkResult = await request(
        queryPath('/mobile/teacher/homework', {
          classId: scope.classId,
          sectionId: scope.sectionId,
          subjectId: scope.subjectId,
          limit: 10,
        }),
        { headers: authHeaders(classTeacherLogin.token) },
      );
      record(
        'Class teacher scoped homework list',
        homeworkResult.status === 200,
        `HTTP ${homeworkResult.status}`,
      );
    }

    const timetableResult = await request('/mobile/teacher/timetable?days=7', {
      headers: authHeaders(classTeacherLogin.token),
    });
    record(
      'Class teacher timetable read',
      timetableResult.status === 200,
      `HTTP ${timetableResult.status}`,
    );
  }

  const subjectTeacherLogin = await login(subjectTeacherEmail);
  if (subjectTeacherLogin.token) {
    const scopesResult = await request('/mobile/teacher/homework/scopes', {
      headers: authHeaders(subjectTeacherLogin.token),
    });
    record(
      'Subject teacher homework scopes',
      scopesResult.status === 200,
      `HTTP ${scopesResult.status}`,
    );
  }

  const parentLogin = await login(parentEmail);
  if (parentLogin.token) {
    const childrenResult = await request('/mobile/me/students', {
      headers: authHeaders(parentLogin.token),
    });
    const childId = getItems(childrenResult.body)[0]?.id;
    if (childId) {
      const homeworkResult = await request(
        `/mobile/students/${childId}/homework`,
        { headers: authHeaders(parentLogin.token) },
      );
      record(
        'Parent linked-child homework summary',
        homeworkResult.status === 200,
        `HTTP ${homeworkResult.status}`,
      );
    }
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m6-homework-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M6 Homework verification (${stamp}, local)

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
