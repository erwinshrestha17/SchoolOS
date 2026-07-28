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
  teacher: {
    email:
      process.env.SMOKE_STAGE4_TEACHER_EMAIL ?? "classteacher.1a@schoolos.com",
    password:
      process.env.SMOKE_STAGE4_TEACHER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ??
      localDemoPassword,
  },
};
const checks = [];

try {
  const [admin, principal, teacher] = await Promise.all([
    login(accounts.admin),
    login(accounts.principal),
    login(accounts.teacher),
  ]);
  pass("Seeded Stage 4 personas can authenticate");

  const walkthroughs = await requestJson(
    "/mobile/principal/classroom-walkthroughs",
    {},
    principal,
  );
  assert(
    walkthroughs.academicYearId &&
      walkthroughs.teacherOptions?.length > 0 &&
      walkthroughs.observations?.some(
        (item) => item.id === "e4a00000-0000-4000-8000-000000000001",
      ),
    "Teacher-development fixture or principal teacher options are missing",
  );
  pass("Principal receives the current-year teacher-development workspace");

  await expectStatus(
    "/mobile/principal/classroom-walkthroughs",
    {},
    teacher,
    [403],
  );
  pass("Teacher cannot open the Principal walkthrough workspace");

  const observationPayload = {
    teacherStaffId: walkthroughs.teacherOptions[0].id,
    academicYearId: walkthroughs.academicYearId,
    observedOn: "2026-07-28",
    strengths: "Learners explained their reasoning during group practice.",
    developmentFocus:
      "Check every group before moving to independent practice.",
    agreedAction: "Use two planned understanding checks in each lesson.",
    followUpOn: "2026-08-12",
    clientRequestId: randomUUID(),
  };
  const observation = await requestJson(
    "/mobile/principal/classroom-walkthroughs",
    { method: "POST", body: JSON.stringify(observationPayload) },
    principal,
  );
  const replay = await requestJson(
    "/mobile/principal/classroom-walkthroughs",
    { method: "POST", body: JSON.stringify(observationPayload) },
    principal,
  );
  assert(
    observation.id && replay.id === observation.id && replay.replayed === true,
    "Walkthrough create did not replay idempotently",
  );
  pass("Principal observation create is tenant-scoped and idempotent");

  const completedObservation = await requestJson(
    `/mobile/principal/classroom-walkthroughs/${encodeURIComponent(
      observation.id,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: observation.version,
        status: "COMPLETED",
        reason: "The observation and feedback conversation are complete.",
        agreedAction: observationPayload.agreedAction,
      }),
    },
    principal,
  );
  assert(
    completedObservation.status === "COMPLETED" &&
      completedObservation.version === observation.version + 1,
    "Reasoned observation transition was not versioned",
  );
  pass("Observation lifecycle uses a reason and optimistic concurrency");

  const plans = await requestJson(
    "/mobile/principal/school-improvement-plans",
    {},
    principal,
  );
  const plan = getItems(plans).find(
    (item) => item.id === "e4a00000-0000-4000-8000-000000000004",
  );
  const action = plan?.actions?.find(
    (item) => item.id === "e4a00000-0000-4000-8000-000000000006",
  );
  assert(
    plan?.status === "ACTIVE" && plan.kpis?.length > 0 && action,
    "School improvement fixture is incomplete",
  );
  pass("Principal receives an owned plan, indicator, action, and review");

  const updatedAction = await requestJson(
    `/mobile/principal/school-improvement-actions/${encodeURIComponent(
      action.id,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: action.version,
        status: action.status,
        reason: "Principal reviewed progress in the monthly plan meeting.",
        progressNote: "Monthly review confirmed and next follow-up assigned.",
      }),
    },
    principal,
  );
  assert(
    updatedAction.version === action.version + 1 &&
      updatedAction.progressNote.includes("Monthly review"),
    "School improvement action update was not versioned",
  );
  pass("Improvement action update is reasoned and versioned");

  await expectStatus(
    "/mobile/principal/school-improvement-plans",
    {},
    teacher,
    [403],
  );
  pass("Teacher cannot open the Principal school-improvement contract");

  for (const track of ["GRADE_8", "SEE", "GRADE_12"]) {
    const readiness = await requestJson(
      `/mobile/principal/board-exam-readiness/${track}`,
      {},
      principal,
    );
    const serialized = JSON.stringify(readiness);
    assert(
      readiness.track === track &&
        readiness.nonPredictive === true &&
        Array.isArray(readiness.indicators) &&
        !/predictedScore|passProbability|rank|percentile/i.test(serialized),
      `${track} readiness is missing or contains a predictive field`,
    );
  }
  pass(
    "Grade 8, SEE, and Grade 12 readiness are explainable and non-predictive",
  );

  const iemisExport = await requestJson("/students/iemis/export", {}, admin);
  assert(
    iemisExport.fileAssetId &&
      !("csv" in iemisExport) &&
      !("rows" in iemisExport) &&
      !("headers" in iemisExport),
    "iEMIS export returned raw file contents instead of protected metadata",
  );
  pass("iEMIS export returns protected file metadata without raw row leakage");

  console.log(
    `Stage 4 institutional-improvement integration passed ${checks.length}/${checks.length} checks.`,
  );
  for (const check of checks) console.log(`✓ ${check}`);
} catch (error) {
  console.error(
    `Stage 4 institutional-improvement integration failed: ${
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
  assert(body?.accessToken, `Login omitted a token for ${account.email}`);
  return body.accessToken;
}

async function requestJson(path, init = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} returned ${response.status}: ${
        body?.message ?? text
      }`,
    );
  }
  return body;
}

async function expectStatus(path, init, token, statuses) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  assert(
    statuses.includes(response.status),
    `${init.method ?? "GET"} ${path} returned ${response.status}; expected ${statuses.join(
      " or ",
    )}`,
  );
}

function getItems(value) {
  return Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : [];
}

function pass(message) {
  checks.push(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}
