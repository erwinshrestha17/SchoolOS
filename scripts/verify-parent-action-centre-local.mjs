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
const adminAccount = {
  email: process.env.SMOKE_EMAIL ?? "admin@schoolos.com",
  password:
    process.env.SMOKE_PASSWORD ??
    process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
    localDemoPassword,
};
const parentAccount = {
  email: process.env.SMOKE_PARENT_EMAIL ?? "guardian.c01a001@schoolos.test",
  password:
    process.env.SMOKE_PARENT_PASSWORD ??
    process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
    localDemoPassword,
};

const checks = [];
let adminToken;
let createdNoticeId;

try {
  adminToken = await login(adminAccount);
  const parentToken = await login(parentAccount);
  pass("Seeded admin and parent can authenticate");

  const children = await requestJson("/mobile/me/students", {}, parentToken);
  const child = getItems(children)[0];
  assert(child?.id, "Parent has no linked child fixture");
  pass("Parent linked-child scope is available");

  const marker = randomUUID().slice(0, 8);
  const notice = await requestJson(
    "/notices",
    {
      method: "POST",
      body: JSON.stringify({
        title: `Required parent action check ${marker}`,
        body: "Please review and confirm this local verification notice.",
        priority: "NORMAL",
        audienceType: "ALL",
        requiresAcknowledgement: true,
      }),
    },
    adminToken,
  );
  createdNoticeId = notice?.id;
  assert(createdNoticeId, "Required notice creation omitted its id");
  assert(
    notice.requiresAcknowledgement === true,
    "Required notice creation did not persist the acknowledgement flag",
  );
  pass("Admin can publish a required-acknowledgement notice");

  const notification = await waitForNotification(parentToken, createdNoticeId);
  assert(
    notification.requiresAcknowledgement === true,
    "Parent notification omitted the required-acknowledgement flag",
  );
  assert(
    notification.acknowledgedAt === null,
    "Fresh required notice was already acknowledged",
  );
  pass("Parent notification exposes required and pending state");

  const digest = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/weekly-progress`,
    {},
    parentToken,
  );
  assertWeeklyEvidence(digest, child.id);
  assert(
    digest.requiredActions?.some(
      (item) =>
        item.type === "NOTICE_ACKNOWLEDGEMENT" &&
        item.id === `notice-ack:${createdNoticeId}`,
    ),
    "Weekly digest omitted the pending required notice",
  );
  assertKnownActionRoutes(digest.requiredActions);
  assertKnownActionRoutes(digest.upcomingDeadlines);
  pass("Linked-child weekly digest returns bounded source-owned evidence");

  const centre = await requestJson("/mobile/me/action-centre", {}, parentToken);
  assert(centre.dataState === "LIVE", "Action centre did not report live data");
  assert(
    centre.summary?.visibleActionCount >= centre.items?.length,
    "Action centre summary is smaller than its returned task list",
  );
  assert(
    centre.items?.some(
      (item) =>
        item.type === "NOTICE_ACKNOWLEDGEMENT" &&
        item.action?.route === `/notices/${notification.id}`,
    ),
    "Required notice was not returned as a parent action",
  );
  assertKnownActionRoutes(centre.items);
  pass("All-children action centre returns the required notice safely");

  const childCentre = await requestJson(
    `/mobile/me/action-centre?studentId=${encodeURIComponent(child.id)}`,
    {},
    parentToken,
  );
  assert(
    childCentre.scope?.selectedStudentId === child.id,
    "Child-scoped action centre lost the linked-child selection",
  );
  assert(
    childCentre.scope?.children?.every((item) => item.id === child.id),
    "Child-scoped action centre returned another child",
  );
  pass("Child filter remains linked-child scoped");

  const adminActionResponse = await requestRaw(
    "/mobile/me/action-centre",
    {},
    adminToken,
  );
  assert(
    adminActionResponse.status === 403,
    `Non-parent action-centre request returned HTTP ${adminActionResponse.status}`,
  );
  pass("Non-parent action-centre access fails closed");

  const adminDigestResponse = await requestRaw(
    `/mobile/students/${encodeURIComponent(child.id)}/weekly-progress`,
    {},
    adminToken,
  );
  assert(
    adminDigestResponse.status === 403,
    `Non-parent weekly-progress request returned HTTP ${adminDigestResponse.status}`,
  );
  pass("Non-parent weekly-progress access fails closed");

  const firstAcknowledgement = await requestJson(
    `/notices/${encodeURIComponent(createdNoticeId)}/acknowledge`,
    { method: "POST" },
    parentToken,
  );
  assert(
    firstAcknowledgement?.firstAcknowledgedAt,
    "Acknowledgement response omitted its timestamp",
  );
  const replayedAcknowledgement = await requestJson(
    `/notices/${encodeURIComponent(createdNoticeId)}/acknowledge`,
    { method: "POST" },
    parentToken,
  );
  assert(
    replayedAcknowledgement?.id === firstAcknowledgement.id,
    "Acknowledgement replay created another record",
  );
  pass("Required notice acknowledgement is idempotent");

  const detail = await requestJson(
    `/notices/${encodeURIComponent(createdNoticeId)}`,
    {},
    parentToken,
  );
  assert(
    detail.requiresAcknowledgement === true && detail.acknowledgedAt,
    "Parent notice detail did not return the confirmed state",
  );
  pass("Parent notice detail returns durable confirmed state");

  const after = await requestJson("/mobile/me/action-centre", {}, parentToken);
  assert(
    !after.items?.some(
      (item) =>
        item.type === "NOTICE_ACKNOWLEDGEMENT" &&
        item.id === `notice-ack:${createdNoticeId}`,
    ),
    "Acknowledged notice remained in the parent action centre",
  );
  pass("Confirmed notice is removed from current actions");

  const afterDigest = await requestJson(
    `/mobile/students/${encodeURIComponent(child.id)}/weekly-progress`,
    {},
    parentToken,
  );
  assert(
    !afterDigest.requiredActions?.some(
      (item) =>
        item.type === "NOTICE_ACKNOWLEDGEMENT" &&
        item.id === `notice-ack:${createdNoticeId}`,
    ),
    "Acknowledged notice remained in the weekly digest",
  );
  pass("Weekly digest reflects the durable acknowledgement immediately");

  console.log(
    `Parent action-centre and weekly-progress integration passed ${checks.length}/${checks.length} checks.`,
  );
  for (const check of checks) console.log(`✓ ${check}`);
} catch (error) {
  console.error(
    `Parent action-centre integration failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  if (createdNoticeId && adminToken) {
    try {
      await requestJson(
        `/notices/${encodeURIComponent(createdNoticeId)}/archive`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Completed local parent action-centre verification.",
          }),
        },
        adminToken,
      );
    } catch (error) {
      console.error(
        `Verification notice cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exitCode = 1;
    }
  }
}

async function waitForNotification(token, noticeId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const feed = await requestJson(
      "/mobile/me/notifications?limit=100",
      {},
      token,
    );
    const notification = getItems(feed).find(
      (item) => item.noticeId === noticeId,
    );
    if (notification) return notification;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Required notice delivery did not reach the parent feed");
}

function assertKnownActionRoutes(items) {
  const routes = (items ?? [])
    .map((item) => item.action?.route)
    .filter(Boolean);
  const known = routes.every((route) => {
    const uri = new URL(route, "https://mobile.schoolos.local");
    if (uri.origin !== "https://mobile.schoolos.local") return false;
    return (
      /^\/notices\/[^/]+$/.test(uri.pathname) ||
      /^\/parent\/homework\/[^/]+$/.test(uri.pathname) ||
      [
        "/parent/fees",
        "/parent/attendance",
        "/parent/more/help-requests",
        "/parent/more/calendar",
      ].includes(uri.pathname)
    );
  });
  assert(known, "Action centre returned an unknown or external route");
}

function assertWeeklyEvidence(digest, childId) {
  assert(digest?.dataState === "LIVE", "Weekly digest did not report live data");
  assert(
    digest?.student?.id === childId,
    "Weekly digest returned a different child",
  );
  assert(
    digest?.period?.days === 7,
    "Weekly digest period is not the owned seven-day window",
  );
  assert(
    Number.isFinite(Date.parse(digest.period?.startAt)) &&
      Number.isFinite(Date.parse(digest.period?.endAt)) &&
      Number.isFinite(Date.parse(digest.period?.upcomingEndAt)),
    "Weekly digest period omitted a bounded timestamp",
  );
  assertNullableRate(
    digest?.attendance?.attendanceRate,
    digest?.attendance?.availability,
    "attendance",
  );
  assertNullableRate(
    digest?.homework?.completionRate,
    digest?.homework?.availability,
    "homework",
  );

  const trend = digest?.academicTrend;
  if (trend?.availability === "AVAILABLE") {
    assert(
      ["IMPROVED", "DECLINED", "STABLE"].includes(trend.direction),
      "Available academic trend omitted a valid direction",
    );
    assert(
      Number.isFinite(trend.changePoints) &&
        trend.current?.reportCardId &&
        trend.previous?.reportCardId &&
        trend.current.reportCardId !== trend.previous.reportCardId,
      "Available academic trend omitted two distinct published results",
    );
  } else {
    assert(
      trend?.direction === null &&
        trend?.changePoints === null &&
        trend?.current === null &&
        trend?.previous === null,
      "Non-comparable academic evidence produced a trend claim",
    );
  }
  assert(
    Array.isArray(digest?.teacherComments) &&
      digest.teacherComments.length <= 5 &&
      Array.isArray(digest?.upcomingDeadlines) &&
      digest.upcomingDeadlines.length <= 5 &&
      Array.isArray(digest?.requiredActions) &&
      digest.requiredActions.length <= 10,
    "Weekly digest exceeded a bounded source list",
  );
}

function assertNullableRate(value, availability, label) {
  if (availability === "AVAILABLE") {
    assert(
      Number.isFinite(value) && value >= 0 && value <= 100,
      `Available ${label} rate is outside 0-100`,
    );
    return;
  }
  assert(value === null, `Unavailable ${label} rate was fabricated`);
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
  assert(body?.accessToken, "Login response omitted accessToken");
  return body.accessToken;
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
  return parsed?.data ?? parsed;
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
