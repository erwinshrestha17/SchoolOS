#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
loadEnvFile(resolve(root, "apps/api/.env"));

const baseUrl =
  process.env.SMOKE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? "default-school";
const localDemoPassword =
  process.env.SCHOOLOS_DEMO_PASSWORD ?? "schoolos-local-demo-only";
const parentAccount = {
  email: process.env.SMOKE_PARENT_EMAIL ?? "guardian.c01a001@schoolos.test",
  password:
    process.env.SMOKE_PARENT_PASSWORD ??
    process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
    localDemoPassword,
};
const otherParentAccount = {
  email:
    process.env.SMOKE_OTHER_PARENT_EMAIL ?? "guardian.c01a002@schoolos.test",
  password:
    process.env.SMOKE_OTHER_PARENT_PASSWORD ??
    process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
    localDemoPassword,
};
const principalAccount = {
  email: process.env.SMOKE_PRINCIPAL_EMAIL ?? "principal@schoolos.com",
  password:
    process.env.SMOKE_PRINCIPAL_PASSWORD ??
    process.env.SCHOOLOS_DEMO_PRINCIPAL_PASSWORD ??
    localDemoPassword,
};

const checks = [];

try {
  const parentToken = await login(parentAccount);
  const otherParentToken = await login(otherParentAccount);
  const principalToken = await login(principalAccount);
  pass("Seeded parent, second parent, and principal can authenticate");

  const children = await requestJson("/mobile/me/students", {}, parentToken);
  const child = getItems(children)[0];
  assert(child?.id, "Parent has no linked child fixture");
  pass("Parent child scope is available");

  const feesBefore = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/fees-summary`,
    {},
    parentToken,
  );
  const invoice = feesBefore?.recentInvoices?.find((item) => item?.id);
  assert(invoice?.id, "Linked child has no invoice fixture");
  const invoiceTruthBefore = financeFingerprint(invoice);
  pass("Backend-owned invoice truth is available before dispute creation");

  const existingRequests = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/service-requests`,
    {},
    parentToken,
  );
  for (const existing of getItems(existingRequests)) {
    if (
      existing.type === "PAYMENT_DISPUTE" &&
      existing.invoice?.id === invoice.id &&
      existing.status === "OPEN" &&
      existing.subject?.startsWith("Local reconciliation check ")
    ) {
      await requestJson(
        `/mobile/service-requests/${encodeURIComponent(existing.id)}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Superseded by a repeated local verification run.",
          }),
        },
        parentToken,
      );
    }
  }

  const idempotencyKey = randomUUID();
  const createPayload = {
    type: "PAYMENT_DISPUTE",
    category: "FEES_AND_PAYMENTS",
    priority: "NORMAL",
    subject: `Local reconciliation check ${idempotencyKey.slice(0, 8)}`,
    description:
      "Please review this seeded invoice balance without changing the finance record.",
    invoiceId: invoice.id,
    idempotencyKey,
  };
  const created = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/service-requests`,
    {
      method: "POST",
      body: JSON.stringify(createPayload),
    },
    parentToken,
  );
  assert(created?.id, "Create response omitted the request id");
  assert(created.invoice?.id === invoice.id, "Dispute lost its invoice link");
  pass("Parent can create a linked payment dispute");

  const replayed = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/service-requests`,
    {
      method: "POST",
      body: JSON.stringify(createPayload),
    },
    parentToken,
  );
  assert(
    replayed?.id === created.id,
    "Idempotent replay created a different request",
  );
  pass("Create replay is idempotent");

  const crossParent = await requestRaw(
    `/mobile/service-requests/${encodeURIComponent(created.id)}`,
    {},
    otherParentToken,
  );
  assert(
    [403, 404].includes(crossParent.status),
    `Cross-parent read returned HTTP ${crossParent.status}`,
  );
  pass("A different parent cannot read the request");

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const requestWithAttachment = await requestJson(
    `/mobile/service-requests/${encodeURIComponent(created.id)}/attachments`,
    {
      method: "POST",
      body: JSON.stringify({
        fileName: "invoice-evidence.png",
        contentType: "image/png",
        base64Content: pngBase64,
        label: "Seeded invoice evidence",
      }),
    },
    parentToken,
  );
  const attachment = requestWithAttachment?.attachments?.find(
    (item) => item.fileName === "invoice-evidence.png",
  );
  assert(attachment?.id, "Evidence upload omitted the attachment id");
  pass("Evidence is registered through the protected file path");

  const parentDownload = await requestRaw(
    `/mobile/service-requests/${encodeURIComponent(created.id)}/attachments/${encodeURIComponent(attachment.id)}`,
    {},
    parentToken,
  );
  assert(
    parentDownload.status === 200 &&
      parentDownload.headers.get("content-type")?.startsWith("image/png"),
    `Parent evidence download returned HTTP ${parentDownload.status}`,
  );
  pass("Parent can download linked evidence through authentication");

  const triaged = await requestJson(
    `/mobile/principal/service-requests/${encodeURIComponent(created.id)}/triage-self`,
    {
      method: "POST",
      body: JSON.stringify({
        priority: "HIGH",
        responseDeadline: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status: "IN_PROGRESS",
        reason: "Assigning the seeded dispute for accountable follow-through.",
      }),
    },
    principalToken,
  );
  assert(
    triaged?.status === "IN_PROGRESS" && triaged?.assignedTo?.id,
    "Principal triage did not assign the request",
  );
  pass("Principal can self-assign and deadline the request");

  await requestJson(
    `/mobile/principal/service-requests/${encodeURIComponent(created.id)}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        body: "The finance record is being reviewed against the receipt.",
        visibility: "PARENT",
      }),
    },
    principalToken,
  );
  await requestJson(
    `/mobile/principal/service-requests/${encodeURIComponent(created.id)}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        body: "Internal reconciliation checkpoint for the assigned reviewer.",
        visibility: "INTERNAL",
      }),
    },
    principalToken,
  );

  const principalDetail = await requestJson(
    `/mobile/principal/service-requests/${encodeURIComponent(created.id)}`,
    {},
    principalToken,
  );
  assert(
    principalDetail.notes?.some((note) =>
      note.body.includes("finance record is being reviewed"),
    ),
    "Principal detail omitted the parent-visible note",
  );
  assert(
    principalDetail.internalNotes?.some((note) =>
      note.body.includes("Internal reconciliation checkpoint"),
    ),
    "Principal detail omitted the internal note",
  );
  pass("Principal can add distinct parent-visible and internal notes");

  const principalAttachmentPath =
    principalDetail.attachments?.[0]?.downloadPath;
  assert(
    principalAttachmentPath?.startsWith(
      `/service-requests/${created.id}/attachments/`,
    ),
    "Principal attachment exposed an untrusted download path",
  );
  const principalDownload = await requestRaw(
    principalAttachmentPath,
    {},
    principalToken,
  );
  assert(
    principalDownload.status === 200,
    `Principal evidence download returned HTTP ${principalDownload.status}`,
  );
  pass("Principal evidence uses the protected manager download route");

  const parentDetail = await requestJson(
    `/mobile/service-requests/${encodeURIComponent(created.id)}`,
    {},
    parentToken,
  );
  assert(
    parentDetail.notes?.some((note) =>
      note.body.includes("finance record is being reviewed"),
    ),
    "Parent detail omitted the parent-visible note",
  );
  assert(
    !JSON.stringify(parentDetail).includes(
      "Internal reconciliation checkpoint",
    ),
    "Parent response leaked an internal note",
  );
  pass("Parent sees updates without internal-note leakage");

  const resolved = await requestJson(
    `/mobile/principal/service-requests/${encodeURIComponent(created.id)}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({
        resolutionSummary:
          "The receipt and invoice were reviewed; no finance mutation was required.",
      }),
    },
    principalToken,
  );
  assert(resolved?.status === "RESOLVED", "Resolve did not set RESOLVED");

  const closed = await requestJson(
    `/mobile/service-requests/${encodeURIComponent(created.id)}/confirm-resolution`,
    { method: "POST" },
    parentToken,
  );
  assert(
    closed?.status === "CLOSED",
    "Parent confirmation did not close request",
  );
  pass("Principal resolution and parent confirmation close the lifecycle");

  const feesAfter = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/fees-summary`,
    {},
    parentToken,
  );
  const invoiceAfter = feesAfter?.recentInvoices?.find(
    (item) => item?.id === invoice.id,
  );
  assert(invoiceAfter, "Linked invoice disappeared after dispute resolution");
  assert(
    financeFingerprint(invoiceAfter) === invoiceTruthBefore,
    "Dispute lifecycle mutated backend invoice truth",
  );
  pass("Payment dispute lifecycle does not mutate invoice truth");

  const list = await requestJson(
    "/mobile/principal/service-requests?page=1&limit=25",
    {},
    principalToken,
  );
  assert(
    list.items?.some((item) => item.id === created.id),
    "Principal paginated list omitted the closed request",
  );
  pass("Principal paginated queue includes the completed request");

  for (const check of checks) {
    console.log(`PASS ${check}`);
  }
  console.log(
    `Service-request integration: ${checks.length}/${checks.length} passed`,
  );
} catch (error) {
  console.error(
    `Service-request integration failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}

async function login(account) {
  const body = await requestJson("/auth/login", {
    method: "POST",
    headers: { "User-Agent": "flutter" },
    body: JSON.stringify({
      tenantSlug,
      email: account.email,
      password: account.password,
    }),
  });
  const token = body?.accessToken;
  assert(token, "Login response omitted accessToken");
  return token;
}

async function requestJson(path, options = {}, token) {
  const response = await requestRaw(path, options, token);
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${options.method ?? "GET"} ${path} returned non-JSON`);
  }
  if (!response.ok) {
    const message =
      parsed?.message ?? parsed?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${options.method ?? "GET"} ${path}: ${message}`);
  }
  return unwrap(parsed);
}

function requestRaw(path, options = {}, token) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": "flutter",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

function unwrap(value) {
  return value?.data ?? value;
}

function getItems(value) {
  const body = unwrap(value);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function financeFingerprint(invoice) {
  return JSON.stringify({
    id: invoice.id,
    status: invoice.status,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    outstandingAmount: invoice.outstandingAmount,
  });
}

function pass(name) {
  checks.push(name);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
