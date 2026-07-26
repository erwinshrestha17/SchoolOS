#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
loadEnvFile(resolve(root, "apps/api/.env"));

const baseUrl =
  process.env.SMOKE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const tenantSlug = process.env.SMOKE_TENANT_SLUG ?? "default-school";
const localDemoPassword =
  process.env.SCHOOLOS_DEMO_PASSWORD ?? "schoolos-local-demo-only";
const accounts = {
  admin: {
    email: process.env.SMOKE_EMAIL ?? "admin@schoolos.com",
    password:
      process.env.SMOKE_PASSWORD ??
      process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
      localDemoPassword,
  },
  principal: {
    email: process.env.SMOKE_PRINCIPAL_EMAIL ?? "principal@schoolos.com",
    password:
      process.env.SMOKE_PRINCIPAL_PASSWORD ??
      process.env.SCHOOLOS_DEMO_PRINCIPAL_PASSWORD ??
      localDemoPassword,
  },
  parent: {
    email:
      process.env.SMOKE_PARENT_EMAIL ?? "guardian.c01a001@schoolos.test",
    password:
      process.env.SMOKE_PARENT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
      localDemoPassword,
  },
  otherParent: {
    email:
      process.env.SMOKE_OTHER_PARENT_EMAIL ??
      "guardian.c01a002@schoolos.test",
    password:
      process.env.SMOKE_OTHER_PARENT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
      localDemoPassword,
  },
  teacher: {
    email:
      process.env.SMOKE_CLASS_TEACHER_EMAIL ??
      "classteacher.1a@schoolos.com",
    password:
      process.env.SMOKE_CLASS_TEACHER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ??
      localDemoPassword,
  },
};

const checks = [];
let adminToken;
let principalToken;
let parentToken;
let principalUserId;
let adminUserId;
let approvalRequestId;
let approvalClosed = false;
let activeCorrectionId;
let activeCorrectionStudentId;

try {
  const [admin, principal, parent, otherParentToken, teacherToken] =
    await Promise.all([
      login(accounts.admin),
      login(accounts.principal),
      login(accounts.parent),
      login(accounts.otherParent),
      login(accounts.teacher),
    ]);
  adminToken = admin;
  principalToken = principal;
  parentToken = parent;
  pass("Seeded Stage 2 personas can authenticate");

  const [adminProfile, principalProfile] = await Promise.all([
    requestJson("/auth/me", {}, adminToken),
    requestJson("/auth/me", {}, principalToken),
  ]);
  adminUserId = adminProfile?.userId;
  principalUserId = principalProfile?.userId;
  assert(adminUserId && principalUserId, "Approval actors omitted user ids");

  await verifyMissingSubmissions(principalToken, teacherToken);
  await verifyGenericApprovalLifecycle(adminToken, principalToken);
  await verifyParentAttendanceCorrection(
    parentToken,
    otherParentToken,
    principalToken,
  );

  console.log(
    `Stage 2 operational-control integration passed ${checks.length}/${checks.length} checks.`,
  );
  for (const check of checks) console.log(`✓ ${check}`);
} catch (error) {
  console.error(
    `Stage 2 operational-control integration failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  if (
    activeCorrectionId &&
    activeCorrectionStudentId &&
    parentToken
  ) {
    try {
      await requestJson(
        `/mobile/students/${encodeURIComponent(
          activeCorrectionStudentId,
        )}/attendance-corrections/${encodeURIComponent(
          activeCorrectionId,
        )}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Closing an interrupted local Stage 2 verification.",
          }),
        },
        parentToken,
      );
    } catch (error) {
      console.error(
        `Attendance-correction cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exitCode = 1;
    }
  }

  if (
    approvalRequestId &&
    !approvalClosed &&
    adminToken &&
    principalToken &&
    adminUserId &&
    principalUserId
  ) {
    try {
      await closeApprovalFixture();
    } catch (error) {
      console.error(
        `Approval cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exitCode = 1;
    }
  }
}

async function verifyMissingSubmissions(principal, teacher) {
  const first = await requestJson(
    "/mobile/principal/academics-readiness",
    {},
    principal,
  );
  assertReadinessArithmetic(first);
  pass("Principal academics readiness uses active-student mark denominators");

  const second = await requestJson(
    "/mobile/principal/academics-readiness",
    {},
    principal,
  );
  assert(
    readinessFingerprint(first) === readinessFingerprint(second),
    "Unchanged academics readiness produced unstable mark totals",
  );
  pass("Missing-submission totals are stable across unchanged reads");

  await expectStatus(
    "/mobile/principal/academics-readiness",
    {},
    teacher,
    [403],
  );
  pass("Teacher access to the principal readiness endpoint fails closed");
}

async function verifyGenericApprovalLifecycle(admin, principal) {
  const marker = randomUUID().slice(0, 8);
  const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const created = await requestJson(
    "/advanced/approvals",
    {
      method: "POST",
      body: JSON.stringify({
        workflowType: "ATTENDANCE_CORRECTION",
        title: `Local Stage 2 approval check ${marker}`,
        reason:
          "Verify deadline, delegation, idempotency, and fail-closed final action behavior.",
        targetModule: "attendance",
        targetType: "attendance_record",
        targetId: randomUUID(),
        safeContext: { verification: "local-stage-2" },
        idempotencyKey: randomUUID(),
        deadlineAt,
      }),
    },
    admin,
  );
  approvalRequestId = created?.id;
  assert(approvalRequestId, "Generic approval creation omitted its id");

  const inbox = await requestJson(
    "/mobile/principal/approvals?status=pending",
    {},
    principal,
  );
  const inboxItem = getItems(inbox).find(
    (item) => item.id === approvalRequestId,
  );
  assert(
    inboxItem?.route === `/principal/approvals/${approvalRequestId}`,
    "Generic approval was not actionable from the unified inbox",
  );
  pass("Generic request appears in the unified Principal approval inbox");

  const detail = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(approvalRequestId)}`,
    {},
    principal,
  );
  assert(
    detail?.status === "PENDING" &&
      detail?.deadline?.at === deadlineAt &&
      detail?.deadline?.overdue === false,
    "Approval detail lost its pending deadline",
  );
  assert(
    detail?.actions?.approve === false &&
      detail?.actions?.reject === true &&
      detail?.actions?.delegate === true &&
      detail?.actions?.unavailableReason?.includes("final action"),
    "Approval actions did not fail closed around the missing executor",
  );
  pass("Approval deadline and fail-closed actions are explicit");

  await expectStatus(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVE",
        reason: "This must not claim an unapplied approval.",
        idempotencyKey: randomUUID(),
      }),
    },
    principal,
    [409],
  );
  const afterBlockedApproval = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(approvalRequestId)}`,
    {},
    principal,
  );
  assert(
    afterBlockedApproval.status === "PENDING" &&
      afterBlockedApproval.steps?.every((step) => step.status === "PENDING") &&
      afterBlockedApproval.history?.filter(
        (item) => item.action === "APPROVE",
      ).length === 0,
    "Blocked approval mutated the workflow",
  );
  pass("Unavailable final action cannot create a false approval");

  const candidates = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/delegation-candidates`,
    {},
    principal,
  );
  assert(
    getItems(candidates).some((candidate) => candidate.id === adminUserId),
    "Seeded admin is not an eligible approval delegate",
  );

  const delegationReason =
    "Delegate this local verification to the alternate school approver.";
  const delegated = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/delegation`,
    {
      method: "POST",
      body: JSON.stringify({
        delegatedToUserId: adminUserId,
        reason: delegationReason,
      }),
    },
    principal,
  );
  assert(
    delegated?.delegation?.delegatedTo?.id === adminUserId &&
      delegated?.delegation?.reason === delegationReason &&
      delegated?.timestamps?.delegatedAt,
    "Delegation metadata was not persisted",
  );
  pass("Reasoned delegation is durable and visible");

  await expectStatus(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECT",
        reason: "The original approver must be denied while delegated.",
        idempotencyKey: randomUUID(),
      }),
    },
    principal,
    [403],
  );
  pass("The original approver fails closed while the step is delegated");

  await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/delegation`,
    {
      method: "POST",
      body: JSON.stringify({
        delegatedToUserId: principalUserId,
        reason: "Return the local verification to the original approver.",
      }),
    },
    admin,
  );

  const decisionKey = randomUUID();
  const rejected = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECT",
        reason: "Close the local Stage 2 verification without applying data.",
        idempotencyKey: decisionKey,
      }),
    },
    principal,
  );
  assert(
    rejected?.status === "REJECTED" &&
      rejected?.history?.filter((item) => item.action === "REJECT").length ===
        1,
    "Reasoned rejection did not close the delegated request",
  );

  const replayed = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECT",
        reason: "Close the local Stage 2 verification without applying data.",
        idempotencyKey: decisionKey,
      }),
    },
    principal,
  );
  assert(
    replayed?.status === "REJECTED" &&
      replayed?.history?.filter((item) => item.action === "REJECT").length ===
        1,
    "Approval decision replay created duplicate history",
  );
  approvalClosed = true;
  pass("Reasoned rejection is idempotent and audited once");
}

async function verifyParentAttendanceCorrection(
  parent,
  otherParent,
  principal,
) {
  const children = await requestJson("/mobile/me/students", {}, parent);
  const child = getItems(children)[0];
  assert(child?.id, "Parent has no linked-child attendance fixture");
  activeCorrectionStudentId = child.id;

  await expectStatus(
    `/mobile/students/${encodeURIComponent(child.id)}/attendance-corrections`,
    {},
    otherParent,
    [403, 404],
  );
  pass("Another parent cannot read the linked child correction queue");

  const before = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/attendance-summary`,
    {},
    parent,
  );
  const existing = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/attendance-corrections`,
    {},
    parent,
  );
  const pendingDates = new Set(
    getItems(existing)
      .filter((item) => item.status === "PENDING")
      .map((item) => dateKey(item.attendanceDate)),
  );
  const recorded = (before?.recentHistory ?? []).filter(
    (item) =>
      item?.date &&
      item?.status &&
      !pendingDates.has(dateKey(item.attendanceDate ?? item.date)),
  );
  assert(recorded.length > 0, "Linked child has no usable attendance record");

  const created = await createCorrectionFromHistory(child.id, recorded, parent);
  activeCorrectionId = created.id;
  const originalRecord = recorded.find(
    (item) => dateKey(item.date) === dateKey(created.attendanceDate),
  );
  assert(originalRecord, "Created correction lost its recorded attendance day");
  pass("Parent can request a linked-child recorded-day correction");

  const unifiedInbox = await requestJson(
    "/mobile/principal/approvals?status=pending",
    {},
    principal,
  );
  const correctionInboxItem = getItems(unifiedInbox).find(
    (item) => item.id === created.id,
  );
  assert(
    correctionInboxItem?.type === "attendance_correction" &&
      !correctionInboxItem?.route,
    "Legacy correction row was missing or falsely exposed a generic action",
  );
  pass("Attendance correction is visible but module-owned in the unified inbox");

  const rejected = await requestJson(
    `/attendance/corrections/${encodeURIComponent(created.id)}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "REJECTED",
        reviewReason:
          "Recorded status needs supporting school evidence before correction.",
      }),
    },
    principal,
  );
  assert(rejected?.status === "REJECTED", "Reviewer rejection was not durable");
  activeCorrectionId = undefined;

  const afterRejection = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/attendance-corrections`,
    {},
    parent,
  );
  const parentRejected = getItems(afterRejection).find(
    (item) => item.id === created.id,
  );
  assert(
    parentRejected?.status === "REJECTED" &&
      parentRejected?.canResubmit === true &&
      parentRejected?.reviewReason?.includes("supporting school evidence"),
    "Parent did not receive the rejection reason and resubmission state",
  );
  pass("Parent receives a reasoned rejection and resubmission path");

  const resubmitted = await requestJson(
    `/mobile/students/${encodeURIComponent(
      child.id,
    )}/attendance-corrections`,
    {
      method: "POST",
      body: JSON.stringify({
        attendanceDate: created.attendanceDate,
        requestedStatus: created.requestedStatus,
        reason:
          "Resubmitted local Stage 2 check with the requested school context.",
      }),
    },
    parent,
  );
  activeCorrectionId = resubmitted?.id;
  assert(
    activeCorrectionId &&
      activeCorrectionId !== created.id &&
      resubmitted.status === "PENDING",
    "Rejected correction could not be resubmitted as a new pending request",
  );

  const cancelled = await requestJson(
    `/mobile/students/${encodeURIComponent(
      child.id,
    )}/attendance-corrections/${encodeURIComponent(
      activeCorrectionId,
    )}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: "Close the resubmitted local Stage 2 verification request.",
      }),
    },
    parent,
  );
  assert(cancelled?.status === "CANCELLED", "Resubmission cancellation failed");
  activeCorrectionId = undefined;
  pass("Rejected correction can be resubmitted and cancelled online");

  const after = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/attendance-summary`,
    {},
    parent,
  );
  const unchanged = (after?.recentHistory ?? []).find(
    (item) => dateKey(item.date) === dateKey(originalRecord.date),
  );
  assert(
    attendanceFingerprint(unchanged) ===
      attendanceFingerprint(originalRecord),
    "Rejected and cancelled requests changed official attendance truth",
  );
  pass("Rejected and cancelled corrections leave attendance truth unchanged");
}

async function createCorrectionFromHistory(studentId, history, token) {
  for (const record of history) {
    const requestedStatus =
      record.status === "PRESENT" ? "ABSENT" : "PRESENT";
    const response = await requestRaw(
      `/mobile/students/${encodeURIComponent(
        studentId,
      )}/attendance-corrections`,
      {
        method: "POST",
        body: JSON.stringify({
          attendanceDate: record.date,
          requestedStatus,
          reason: `Local Stage 2 correction check ${randomUUID().slice(0, 8)}.`,
        }),
      },
      token,
    );
    const payload = await parseResponse(response);
    if (response.ok) return unwrap(payload);
    if (response.status === 409) continue;
    throw httpError(response, payload);
  }
  throw new Error(
    "Every recent attendance day already has a pending correction request",
  );
}

function assertReadinessArithmetic(value) {
  const metrics = value?.metrics ?? {};
  const rows = value?.marksEntryStatus ?? [];
  for (const field of [
    "expectedMarks",
    "submittedMarks",
    "pendingMarks",
    "examReadinessPercent",
  ]) {
    assert(
      Number.isFinite(metrics[field]) && metrics[field] >= 0,
      `Academics readiness returned invalid ${field}`,
    );
  }
  assert(
    metrics.expectedMarks > 0 &&
      metrics.submittedMarks <= metrics.expectedMarks &&
      metrics.pendingMarks === metrics.expectedMarks - metrics.submittedMarks,
    "Academics readiness aggregate arithmetic is inconsistent",
  );
  assert(
    metrics.examReadinessPercent ===
      Math.round((metrics.submittedMarks / metrics.expectedMarks) * 100),
    "Academics readiness percentage uses the wrong denominator",
  );
  assert(
    rows.length > 0 &&
      rows.every(
        (row) =>
          Number.isFinite(row.expectedEntries) &&
          Number.isFinite(row.submittedEntries) &&
          Number.isFinite(row.missingEntries) &&
          row.expectedEntries >= row.submittedEntries &&
          row.missingEntries === row.expectedEntries - row.submittedEntries,
      ),
    "Per-class missing-entry arithmetic is inconsistent",
  );
  assert(
    rows.reduce((sum, row) => sum + row.expectedEntries, 0) ===
        metrics.expectedMarks &&
      rows.reduce((sum, row) => sum + row.submittedEntries, 0) ===
        metrics.submittedMarks &&
      rows.reduce((sum, row) => sum + row.missingEntries, 0) ===
        metrics.pendingMarks,
    "Per-class readiness totals do not reconcile to the aggregate",
  );
}

function readinessFingerprint(value) {
  return JSON.stringify({
    metrics: value?.metrics,
    marksEntryStatus: value?.marksEntryStatus,
  });
}

function attendanceFingerprint(record) {
  if (!record) return null;
  return JSON.stringify({
    date: dateKey(record.date),
    status: record.status,
    remark: record.remark ?? null,
  });
}

function dateKey(value) {
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.getTime()), "Attendance returned an invalid date");
  return parsed.toISOString().slice(0, 10);
}

async function closeApprovalFixture() {
  const detail = await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(approvalRequestId)}`,
    {},
    principalToken,
  );
  if (detail?.status !== "PENDING") {
    approvalClosed = true;
    return;
  }
  if (detail?.delegation?.delegatedTo?.id === adminUserId) {
    await requestJson(
      `/mobile/principal/approvals/${encodeURIComponent(
        approvalRequestId,
      )}/delegation`,
      {
        method: "POST",
        body: JSON.stringify({
          delegatedToUserId: principalUserId,
          reason: "Return an interrupted local verification for closure.",
        }),
      },
      adminToken,
    );
  }
  await requestJson(
    `/mobile/principal/approvals/${encodeURIComponent(
      approvalRequestId,
    )}/decisions`,
    {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECT",
        reason: "Close an interrupted local Stage 2 verification.",
        idempotencyKey: randomUUID(),
      }),
    },
    principalToken,
  );
  approvalClosed = true;
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
  assert(body?.accessToken, `Login omitted a token for ${account.email}`);
  return body.accessToken;
}

async function expectStatus(path, options, token, expected) {
  const response = await requestRaw(path, options, token);
  const payload = await parseResponse(response);
  assert(
    expected.includes(response.status),
    `${options.method ?? "GET"} ${path} returned HTTP ${
      response.status
    }, expected ${expected.join("/")}: ${messageFrom(payload)}`,
  );
  return unwrap(payload);
}

async function requestJson(path, options = {}, token) {
  const response = await requestRaw(path, options, token);
  const payload = await parseResponse(response);
  if (!response.ok) throw httpError(response, payload);
  return unwrap(payload);
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

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${response.url} returned a non-JSON HTTP ${response.status} response`,
    );
  }
}

function unwrap(value) {
  return value?.data ?? value;
}

function httpError(response, payload) {
  return new Error(
    `${response.status} ${response.url}: ${messageFrom(payload)}`,
  );
}

function messageFrom(value) {
  const message = value?.message ?? value?.error?.message;
  return Array.isArray(message)
    ? message.join("; ")
    : (message ?? "No response message");
}

function getItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
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
