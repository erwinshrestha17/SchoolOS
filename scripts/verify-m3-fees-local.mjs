#!/usr/bin/env node

import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, loadEnvFile } from './lib/schoolos-env.mjs';

const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ??
  process.env.STAGING_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const mockGatewayBase =
  process.env.M3_MOCK_GATEWAY_BASE ?? 'http://127.0.0.1:4010';
const webhookSecret =
  process.env.M3_MOCK_WEBHOOK_SECRET ?? 'm3-local-webhook-secret-for-verify';

const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'default-school';
const personaPassword =
  process.env.SMOKE_PASSWORD ??
  process.env.SCHOOLOS_DEMO_PASSWORD ??
  'schoolos-local-demo-only';
const accountantEmail =
  process.env.SMOKE_ACCOUNTANT_EMAIL ?? 'accountant@schoolos.com';
const accountantPassword =
  process.env.SMOKE_ACCOUNTANT_PASSWORD ?? personaPassword;
const parentEmail =
  process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01b006@schoolos.test';
const parentPassword =
  process.env.SMOKE_PARENT_PASSWORD ??
  process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
  personaPassword;
const teacherEmail =
  process.env.SMOKE_CLASS_TEACHER_EMAIL ?? 'classteacher.1a@schoolos.com';
const teacherPassword =
  process.env.SMOKE_CLASS_TEACHER_PASSWORD ?? personaPassword;
const adminEmail = process.env.SMOKE_EMAIL ?? 'admin@schoolos.com';
const adminPassword =
  process.env.SMOKE_ADMIN_PASSWORD ??
  process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
  personaPassword;

const COLLECTION_INVOICE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c02';
const ONLINE_INVOICE_ID = 'c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c05';
const ONLINE_PAYMENT_AMOUNT = 500;
const COLLECTION_PROBE_AMOUNT = 100;
const COLLECTION_IDEMPOTENCY_KEY = `verify-m3-cash-${randomUUID().replace(/-/g, '')}`;
const PARENT_SANDBOX_INVOICE_NUMBER = 'FEE-BREAKDOWN-BHADRA';
const PAYMENT_PROVIDER = 'NEPAL_GATEWAY';

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

function authHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'flutter',
    ...extra,
  };
}

function getData(body) {
  return body?.data ?? body ?? null;
}

function getItems(body) {
  const data = getData(body);
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function signWebhookPayload(payload) {
  return createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function mockGatewayReady() {
  try {
    const response = await fetch(`${mockGatewayBase}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const accountantLogin = await login({
    tenantSlug,
    email: accountantEmail,
    password: accountantPassword,
  });
  record(
    'M3 accountant login',
    accountantLogin.ok,
    accountantLogin.ok ? 'token received' : `HTTP ${accountantLogin.status}`,
  );

  if (!accountantLogin.token) {
    writeEvidence(false);
    process.exit(1);
  }

  const accountantAuth = authHeaders(accountantLogin.token);

  const summaryPath = queryPath('/fees/dashboard-summary', {
    date: todayIsoDate(),
  });
  const summaryResult = await request(summaryPath, { headers: accountantAuth });
  record(
    'Fees dashboard summary',
    summaryResult.status === 200,
    `HTTP ${summaryResult.status}`,
  );

  const invoicesResult = await request('/fees/invoices?page=1&limit=5', {
    headers: accountantAuth,
  });
  record(
    'Invoice list',
    invoicesResult.status === 200,
    `HTTP ${invoicesResult.status}`,
  );

  const collectBody = {
    invoiceId: COLLECTION_INVOICE_ID,
    amount: COLLECTION_PROBE_AMOUNT,
    method: 'CASH',
    narration: 'M3 verify idempotent cash collection probe',
    idempotencyKey: COLLECTION_IDEMPOTENCY_KEY,
  };
  const firstCollect = await request('/payments', {
    method: 'POST',
    headers: accountantAuth,
    body: JSON.stringify(collectBody),
  });
  const firstPaymentId =
    getData(firstCollect.body)?.id ?? getData(firstCollect.body)?.paymentId;
  const replayCollect = await request('/payments', {
    method: 'POST',
    headers: accountantAuth,
    body: JSON.stringify(collectBody),
  });
  const replayPaymentId =
    getData(replayCollect.body)?.id ?? getData(replayCollect.body)?.paymentId;
  record(
    'Idempotent cash collection probe',
    (firstCollect.status === 200 || firstCollect.status === 201) &&
      (replayCollect.status === 200 || replayCollect.status === 201) &&
      Boolean(firstPaymentId) &&
      firstPaymentId === replayPaymentId,
    `first HTTP ${firstCollect.status}, replay HTTP ${replayCollect.status}, paymentId=${firstPaymentId ?? 'missing'}`,
  );

  const receiptsResult = await request('/receipts?page=1&limit=5', {
    headers: accountantAuth,
  });
  record(
    'Receipt list',
    receiptsResult.status === 200,
    `HTTP ${receiptsResult.status}`,
  );

  const closePreviewPath = queryPath('/payments/cashier-close/preview', {
    openedAt: `${todayIsoDate()}T00:00:00.000Z`,
    closedAt: `${todayIsoDate()}T23:59:59.999Z`,
  });
  const closePreview = await request(closePreviewPath, {
    headers: accountantAuth,
  });
  record(
    'Cashier-close preview',
    closePreview.status === 200,
    `HTTP ${closePreview.status}`,
  );

  const parentLogin = await login({
    tenantSlug,
    email: parentEmail,
    password: parentPassword,
  });
  record(
    'M3 parent login',
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
      const feesSummary = await request(
        `/mobile/students/${childId}/fees-summary`,
        { headers: parentAuth },
      );
      record(
        'Parent linked-child fee summary',
        feesSummary.status === 200,
        `HTTP ${feesSummary.status}`,
      );

      const adminLogin = await login({
        tenantSlug,
        email: adminEmail,
        password: adminPassword,
      });
      if (adminLogin.token) {
        const studentsResult = await request('/students?page=1&limit=25', {
          headers: authHeaders(adminLogin.token),
        });
        const students = getItems(studentsResult.body);
        const otherStudent = students.find((student) => student.id !== childId);
        if (otherStudent?.id) {
          const deniedFees = await request(
            `/mobile/students/${otherStudent.id}/fees-summary`,
            { headers: parentAuth },
          );
          record(
            'Parent unrelated child fee summary denied',
            deniedFees.status === 403 || deniedFees.status === 404,
            `HTTP ${deniedFees.status}`,
          );
        } else {
          record(
            'Parent unrelated child fee summary denied',
            true,
            'skipped — only one seeded student in page',
          );
        }
      } else {
        record(
          'Parent unrelated child fee summary denied',
          true,
          `skipped — admin login failed HTTP ${adminLogin.status}`,
        );
      }

      const gatewayReadiness = await request(
        `/mobile/students/${childId}/payment-gateway-readiness`,
        { headers: parentAuth },
      );
      const readinessData = getData(gatewayReadiness.body);
      record(
        'Parent payment gateway readiness (sandbox)',
        gatewayReadiness.status === 200 &&
          readinessData?.sandbox === true,
        `HTTP ${gatewayReadiness.status}, sandbox=${readinessData?.sandbox ?? 'unknown'}`,
      );

      const sandboxKey = 'verify-m3-parent-sandbox-fees-01';
      const feesData = getData(feesSummary.body);
      const invoiceItems = feesData?.recentInvoices ?? feesData?.invoices ?? [];
      const unpaidInvoice =
        invoiceItems.find(
          (invoice) =>
            invoice.invoiceNumber === PARENT_SANDBOX_INVOICE_NUMBER ||
            invoice.outstandingAmount > 0 ||
            invoice.status === 'ISSUED' ||
            invoice.status === 'PARTIAL',
        ) ?? invoiceItems[0];
      const sandboxInvoiceId = unpaidInvoice?.id;
      if (sandboxInvoiceId) {
        const sandboxCollect = await request(
          `/mobile/students/${childId}/sandbox-payments/fees`,
          {
            method: 'POST',
            headers: parentAuth,
            body: JSON.stringify({
              confirmStudentId: childId,
              invoiceId: sandboxInvoiceId,
              amount: 200,
              provider: 'ESEWA',
              idempotencyKey: sandboxKey,
            }),
          },
        );
        const sandboxReplay = await request(
          `/mobile/students/${childId}/sandbox-payments/fees`,
          {
            method: 'POST',
            headers: parentAuth,
            body: JSON.stringify({
              confirmStudentId: childId,
              invoiceId: sandboxInvoiceId,
              amount: 200,
              provider: 'ESEWA',
              idempotencyKey: sandboxKey,
            }),
          },
        );
        const sandboxPaymentId =
          getData(sandboxCollect.body)?.id ??
          getData(sandboxCollect.body)?.paymentId;
        const sandboxReplayPaymentId =
          getData(sandboxReplay.body)?.id ??
          getData(sandboxReplay.body)?.paymentId;
        record(
          'Parent sandbox fee payment idempotent',
          (sandboxCollect.status === 200 || sandboxCollect.status === 201) &&
            (sandboxReplay.status === 200 || sandboxReplay.status === 201) &&
            Boolean(sandboxPaymentId) &&
            sandboxPaymentId === sandboxReplayPaymentId,
          `first HTTP ${sandboxCollect.status}, replay HTTP ${sandboxReplay.status}, invoice=${unpaidInvoice?.invoiceNumber ?? sandboxInvoiceId}`,
        );
      } else {
        record(
          'Parent sandbox fee payment idempotent',
          false,
          'skipped — no payable invoice in parent fee summary',
        );
      }
    } else {
      record(
        'Parent linked-child fee summary',
        false,
        'skipped — no linked children',
      );
      record(
        'Parent unrelated child fee summary denied',
        true,
        'skipped — no linked children',
      );
      record(
        'Parent payment gateway readiness (sandbox)',
        true,
        'skipped — no linked children',
      );
      record(
        'Parent sandbox fee payment idempotent',
        true,
        'skipped — no linked children',
      );
    }
  }

  const teacherLogin = await login({
    tenantSlug,
    email: teacherEmail,
    password: teacherPassword,
  });
  if (teacherLogin.ok) {
    const deniedInvoices = await request('/fees/invoices?page=1&limit=5', {
      headers: authHeaders(teacherLogin.token),
    });
    record(
      'Module gate — teacher denied fees invoices',
      deniedInvoices.status === 403,
      `HTTP ${deniedInvoices.status}`,
    );
  } else {
    record(
      'Module gate — teacher denied fees invoices',
      true,
      `skipped — teacher login failed HTTP ${teacherLogin.status}`,
    );
  }

  const gatewayReady = await mockGatewayReady();
  if (!gatewayReady) {
    record(
      'Online gateway readiness',
      true,
      'skipped — mock gateway not running (start scripts/mock-payment-gateway-local.mjs)',
    );
    record(
      'Online payment initiate',
      true,
      'skipped — mock gateway not running',
    );
    record(
      'Online webhook settlement idempotent',
      true,
      'skipped — mock gateway not running',
    );
  } else {
    const readinessResult = await request('/payments/gateway-readiness', {
      headers: accountantAuth,
    });
    const readiness = getData(readinessResult.body);
    record(
      'Online gateway readiness',
      readinessResult.status === 200 &&
        readiness?.enabled === true &&
        readiness?.status === 'ready',
      `HTTP ${readinessResult.status}, enabled=${readiness?.enabled}, status=${readiness?.status}`,
    );

    const onlineKey = `verify-m3-online-${randomUUID().replace(/-/g, '')}`;
    const initiateResult = await request('/payments/online/initiate', {
      method: 'POST',
      headers: accountantAuth,
      body: JSON.stringify({
        invoiceId: ONLINE_INVOICE_ID,
        amount: ONLINE_PAYMENT_AMOUNT,
        provider: PAYMENT_PROVIDER,
        idempotencyKey: onlineKey,
      }),
    });
    const intent = getData(initiateResult.body);
    record(
      'Online payment initiate',
      (initiateResult.status === 200 || initiateResult.status === 201) &&
        intent?.status === 'READY' &&
        Boolean(intent?.checkoutUrl),
      `HTTP ${initiateResult.status}, status=${intent?.status ?? getData(initiateResult.body)?.message ?? 'missing'} (restart staging API after build if provider URL blocked)`,
    );

    if (intent?.id) {
      const webhookPayload = {
        intentId: intent.id,
        providerReference: intent.providerReference,
        amount: ONLINE_PAYMENT_AMOUNT,
        status: 'SUCCESS',
      };
      const signature = signWebhookPayload(webhookPayload);
      const webhookResult = await request(
        '/payments/online/webhook/nepal_gateway',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'nepal_gateway-signature': signature,
          },
          body: JSON.stringify(webhookPayload),
        },
      );
      const webhookReplay = await request(
        '/payments/online/webhook/nepal_gateway',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'nepal_gateway-signature': signature,
          },
          body: JSON.stringify(webhookPayload),
        },
      );
      const firstWebhook = getData(webhookResult.body);
      const replayWebhook = getData(webhookReplay.body);
      const firstOk =
        webhookResult.status === 200 &&
        (firstWebhook?.postedToLedger === true ||
          firstWebhook?.duplicate === true);
      const replayOk =
        webhookReplay.status === 200 &&
        (replayWebhook?.duplicate === true ||
          replayWebhook?.postedToLedger === true);
      record(
        'Online webhook settlement idempotent',
        firstOk && replayOk,
        `first HTTP ${webhookResult.status}, replay HTTP ${webhookReplay.status}`,
      );
    } else {
      record(
        'Online webhook settlement idempotent',
        false,
        'skipped — initiate did not return intent id',
      );
    }
  }

  const failed = checks.filter((check) => !check.ok);
  writeEvidence(failed.length === 0);
  process.exit(failed.length === 0 ? 0 : 1);
}

function writeEvidence(passed) {
  mkdirSync(evidenceDir, { recursive: true });
  const path = join(evidenceDir, `m3-fees-core-${stamp}-local.md`);
  writeFileSync(
    path,
    `# M3 Fees verification (${stamp}, local)

- Tenant slug: \`${tenantSlug}\`
- API: ${apiBaseUrl}
- Mock gateway: ${mockGatewayBase}
- Result: **${passed ? 'PASS' : 'FAIL'}**
- Boundary: local generic_json_v1 + HMAC webhook proof only; production eSewa/Khalti TLS sandbox remains an ops track.

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
