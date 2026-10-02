#!/usr/bin/env node

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/** Shared with seed-m3-payment-gateway-e2e.ts and verify:m3-fees */
export const M3_MOCK_GATEWAY_PORT = Number(
  process.env.M3_MOCK_GATEWAY_PORT ?? 4010,
);
export const M3_MOCK_WEBHOOK_SECRET =
  process.env.M3_MOCK_WEBHOOK_SECRET ?? 'm3-local-webhook-secret-for-verify';

const intentsByIdempotencyKey = new Map();
/** providerReference -> what the gateway knows (the authoritative state). */
const paymentsByProviderReference = new Map();

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${M3_MOCK_GATEWAY_PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // Server-to-server status pull (generic_json_v1 `settlementStatusUrl`).
  if (req.method === 'GET' && url.pathname === '/settlements/status') {
    const reference = url.searchParams.get('reference');
    const providerReference = url.searchParams.get('providerReference');
    const payment =
      (providerReference && paymentsByProviderReference.get(providerReference)) ||
      [...paymentsByProviderReference.values()].find(
        (candidate) => reference && candidate.reference === reference,
      );
    if (!payment) {
      sendJson(res, 404, { message: 'Unknown payment' });
      return;
    }
    sendJson(res, 200, {
      status: payment.paid ? 'SUCCESS' : 'PENDING',
      amount: payment.amount,
      currency: 'NPR',
      reference: payment.reference,
      providerReference: payment.providerReference,
      merchantId: payment.merchantId,
    });
    return;
  }

  // Test-only: the customer completes checkout at the gateway.
  if (req.method === 'POST' && url.pathname.startsWith('/test/pay/')) {
    const payment = paymentsByProviderReference.get(url.pathname.split('/').pop());
    if (!payment) {
      sendJson(res, 404, { message: 'Unknown payment' });
      return;
    }
    payment.paid = true;
    sendJson(res, 200, { status: 'SUCCESS' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/intents') {
    const idempotencyKey = req.headers['idempotency-key'];
    if (typeof idempotencyKey === 'string' && intentsByIdempotencyKey.has(idempotencyKey)) {
      sendJson(res, 200, intentsByIdempotencyKey.get(idempotencyKey));
      return;
    }

    let payload = {};
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { message: 'Invalid JSON body' });
      return;
    }

    const providerReference = `mock-${randomUUID().slice(0, 8)}`;
    const response = {
      providerReference,
      checkoutUrl: `http://127.0.0.1:${M3_MOCK_GATEWAY_PORT}/checkout/${providerReference}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      amount: payload.amount ?? null,
      merchantReference: payload.merchantReference ?? null,
    };

    paymentsByProviderReference.set(providerReference, {
      providerReference,
      reference: payload.reference ?? null,
      merchantId: payload.merchantId ?? null,
      amount: payload.amount == null ? null : Number(payload.amount).toFixed(2),
      paid: false,
    });

    if (typeof idempotencyKey === 'string') {
      intentsByIdempotencyKey.set(idempotencyKey, response);
    }

    sendJson(res, 200, response);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/checkout/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SchoolOS local mock payment gateway checkout page');
    return;
  }

  sendJson(res, 404, { message: 'Not found' });
});

server.listen(M3_MOCK_GATEWAY_PORT, '127.0.0.1', () => {
  console.log(
    `Mock payment gateway listening on http://127.0.0.1:${M3_MOCK_GATEWAY_PORT}`,
  );
});
