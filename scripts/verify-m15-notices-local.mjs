#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const adminEmail =
  process.env.SMOKE_EMAIL ?? 'principal@schoolos.com';
const adminPassword =
  process.env.SMOKE_ADMIN_PASSWORD ??
  process.env.PILOT_REHEARSAL_ADMIN_PASSWORD ??
  personaPassword;
const parentEmail =
  process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01a001@schoolos.test';
const parentPassword =
  process.env.SMOKE_PARENT_PASSWORD ?? personaPassword;

loadEnvFile(join(repoRoot, 'apps/api/.env.staging-local'));
loadEnvFile(join(repoRoot, 'apps/api/.env'));

const checks = [];
const evidenceDir = join(repoRoot, 'docs/production/evidence');
const stamp = new Date().toISOString().slice(0, 10);
let createdNoticeId;
let adminToken;

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
    body: JSON.stringify({ tenantSlug, ...credentials }),
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

async function waitForNotification(token, noticeId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const feed = await request('/mobile/me/notifications?limit=100', {
      headers: authHeaders(token),
    });
    const notification = getItems(feed.body).find(
      (item) => item.noticeId === noticeId,
    );
    if (notification) return notification;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  return null;
}

async function main() {
  const adminLogin = await login({ email: adminEmail, password: adminPassword });
  record(
    'M15 admin login',
    adminLogin.token && (adminLogin.status === 200 || adminLogin.status === 201),
    adminLogin.token ? 'token received' : `HTTP ${adminLogin.status}`,
  );
  if (!adminLogin.token) {
    writeEvidence(false);
    process.exit(1);
  }
  adminToken = adminLogin.token;

  const parentLogin = await login({ email: parentEmail, password: parentPassword });
  record(
    'M15 parent login',
    parentLogin.token && (parentLogin.status === 200 || parentLogin.status === 201),
    parentLogin.token ? 'token received' : `HTTP ${parentLogin.status}`,
  );

  const marker = randomUUID().slice(0, 8);
  const noticeResult = await request('/notices', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: JSON.stringify({
      title: `M15 verify notice ${marker}`,
      body: 'Local M15→M12 delivery verification notice.',
      priority: 'NORMAL',
      audienceType: 'ALL',
      requiresAcknowledgement: true,
    }),
  });
  const notice = noticeResult.body?.data ?? noticeResult.body;
  createdNoticeId = notice?.id;
  record(
    'Admin creates required-acknowledgement notice',
    noticeResult.status === 201 && Boolean(createdNoticeId),
    `HTTP ${noticeResult.status}`,
  );

  if (parentLogin.token && createdNoticeId) {
    const notification = await waitForNotification(
      parentLogin.token,
      createdNoticeId,
    );
    record(
      'Parent receives M12 delivery for published notice',
      Boolean(notification),
      notification ? 'delivery found' : 'timeout',
    );
    record(
      'Delivery exposes pending acknowledgement state',
      notification?.requiresAcknowledgement === true &&
        (notification?.acknowledgedAt === null ||
          notification?.acknowledgedAt === undefined),
      notification ? 'pending ack' : 'no delivery',
    );

    if (notification) {
      const ackResult = await request(
        `/notices/${encodeURIComponent(createdNoticeId)}/acknowledge`,
        { method: 'POST', headers: authHeaders(parentLogin.token) },
      );
      const ackBody = ackResult.body?.data ?? ackResult.body;
      record(
        'Parent acknowledgement idempotent path reachable',
        ackResult.status === 200 || ackResult.status === 201,
        `HTTP ${ackResult.status}`,
      );
      const replayResult = await request(
        `/notices/${encodeURIComponent(createdNoticeId)}/acknowledge`,
        { method: 'POST', headers: authHeaders(parentLogin.token) },
      );
      const replayBody = replayResult.body?.data ?? replayResult.body;
      record(
        'Acknowledgement replay returns same record',
        replayBody?.id === ackBody?.id,
        replayBody?.id ? 'same id' : 'missing id',
      );
    }
  }

  const listResult = await request('/notices?page=1&limit=5', {
    headers: authHeaders(adminToken),
  });
  record(
    'Admin notices queue reachable',
    listResult.status === 200,
    `HTTP ${listResult.status}`,
  );

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m15-notices-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M15 Notices verification (${stamp}, local)

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

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    writeEvidence(false);
    process.exit(1);
  })
  .finally(async () => {
    if (createdNoticeId && adminToken) {
      try {
        await request(`/notices/${encodeURIComponent(createdNoticeId)}/archive`, {
          method: 'POST',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            reason: 'M15 local verification cleanup',
          }),
        });
      } catch {
        // best-effort cleanup
      }
    }
  });
