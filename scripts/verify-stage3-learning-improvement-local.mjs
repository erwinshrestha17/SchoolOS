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
const fixtureStudentId =
  process.env.SMOKE_STAGE3_STUDENT_ID ??
  "b464b734-550e-4cdd-8a77-9f60fda31109";
const fixtureOutcomeId =
  process.env.SMOKE_STAGE3_OUTCOME_ID ??
  "e3a00000-0000-4000-8000-000000000001";

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
      process.env.SMOKE_STAGE3_TEACHER_EMAIL ??
      "classteacher.1a@schoolos.com",
    password:
      process.env.SMOKE_STAGE3_TEACHER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ??
      localDemoPassword,
  },
  parent: {
    email:
      process.env.SMOKE_STAGE3_PARENT_EMAIL ??
      "guardian.c01a002@schoolos.test",
    password:
      process.env.SMOKE_STAGE3_PARENT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
      localDemoPassword,
  },
  unrelatedParent: {
    email:
      process.env.SMOKE_STAGE3_OTHER_PARENT_EMAIL ??
      "guardian.c01a001@schoolos.test",
    password:
      process.env.SMOKE_STAGE3_OTHER_PARENT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
      localDemoPassword,
  },
};

const checks = [];

try {
  const [admin, principal, teacher, parent, unrelatedParent] =
    await Promise.all([
      login(accounts.admin),
      login(accounts.principal),
      login(accounts.teacher),
      login(accounts.parent),
      login(accounts.unrelatedParent),
    ]);
  pass("Seeded Stage 3 personas can authenticate");

  const outcomePage = await requestJson(
    `/learning-improvement/outcomes?limit=100`,
    {},
    admin,
  );
  const outcome = getItems(outcomePage).find(
    (item) => item.id === fixtureOutcomeId,
  );
  assert(outcome, "Dedicated Stage 3 outcome fixture is missing");
  assert(
    outcome.domain === "FOUNDATIONAL_NUMERACY",
    "Foundational outcome lost its Grade 1–3 domain",
  );
  pass("Grade 1–3 foundational outcome remains module-owned and active");

  const parentSummary = await requestJson(
    `/mobile/students/${encodeURIComponent(
      fixtureStudentId,
    )}/learning-summary`,
    {},
    parent,
  );
  assertParentSummary(parentSummary);
  pass("Linked parent sees published, non-comparative learning support");

  await expectStatus(
    `/mobile/students/${encodeURIComponent(
      fixtureStudentId,
    )}/learning-summary`,
    {},
    unrelatedParent,
    [403, 404],
  );
  pass("Unrelated parent access fails closed");

  const scope = {
    academicYearId: outcome.academicYearId,
    classId: outcome.classId,
    sectionId: parentSummary.student.sectionId,
    subjectId: outcome.subject.id,
  };
  const teacherHub = await requestJson(
    `/mobile/teacher/students/${encodeURIComponent(
      fixtureStudentId,
    )}/learning-support?${new URLSearchParams({
      academicYearId: scope.academicYearId,
      classId: scope.classId,
      ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
    })}`,
    {},
    teacher,
  );
  assert(
    teacherHub.student?.id === fixtureStudentId &&
      teacherHub.availableOutcomes?.some(
        (item) => item.id === fixtureOutcomeId,
      ),
    "Assigned teacher hub omitted its student or outcome scope",
  );
  pass("Assigned teacher receives a purpose-limited student support hub");

  const submissionId = randomUUID();
  const assessmentPayload = {
    outcomeId: fixtureOutcomeId,
    academicYearId: scope.academicYearId,
    classId: scope.classId,
    ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
    subjectId: scope.subjectId,
    kind: "OBSERVATION",
    masteryStatus: "BEGINNING",
    assessedOn: new Date().toISOString(),
    note: "Local Stage 3 assignment-scoped formative check.",
    parentSummary:
      "The class is continuing short, guided number-pair practice.",
    clientSubmissionId: submissionId,
  };
  const assessment = await requestJson(
    `/mobile/teacher/students/${encodeURIComponent(
      fixtureStudentId,
    )}/formative-assessments`,
    { method: "POST", body: JSON.stringify(assessmentPayload) },
    teacher,
  );
  const assessmentReplay = await requestJson(
    `/mobile/teacher/students/${encodeURIComponent(
      fixtureStudentId,
    )}/formative-assessments`,
    { method: "POST", body: JSON.stringify(assessmentPayload) },
    teacher,
  );
  assert(
    assessment.id && assessmentReplay.id === assessment.id,
    "Formative assessment replay created another record",
  );
  pass("Teacher formative write is assignment-scoped and idempotent");

  const warnings = await requestJson(
    `/mobile/principal/learning-attention?${new URLSearchParams({
      academicYearId: scope.academicYearId,
      classId: scope.classId,
      ...(scope.sectionId ? { sectionId: scope.sectionId } : {}),
      subjectId: scope.subjectId,
      limit: "100",
    })}`,
    {},
    principal,
  );
  const signal = getItems(warnings).find(
    (item) => item.student?.id === fixtureStudentId,
  );
  assert(
    warnings.nonPredictive === true &&
      warnings.rulesVersion === "stage3-v1" &&
      signal?.reasons?.some((reason) => reason.code === "FORMATIVE_SUPPORT"),
    "Principal warning was not bounded, explainable, and non-predictive",
  );
  pass("Principal sees an explainable rules-only learning signal");

  await expectStatus(
    "/mobile/principal/learning-attention",
    {},
    teacher,
    [403],
  );
  pass("Teacher cannot open the principal attention endpoint");

  const casePayload = {
    academicYearId: scope.academicYearId,
    sourceSignalKey: signal.signalKey,
    priority: "ROUTINE",
    title: `Local number-pair follow-up ${randomUUID().slice(0, 8)}`,
    concernSummary:
      "Recent formative observations require a short, planned follow-up.",
    parentVisibleSummary:
      "The school is continuing short number-pair practice and will share progress.",
    clientRequestId: randomUUID(),
  };
  const createdCase = await requestJson(
    `/mobile/teacher/students/${encodeURIComponent(
      fixtureStudentId,
    )}/interventions`,
    { method: "POST", body: JSON.stringify(casePayload) },
    teacher,
  );
  assert(
    createdCase.id && createdCase.status === "OPEN",
    "Teacher follow-up creation did not return an open case",
  );
  pass("Teacher can start a durable, student-scoped follow-up");

  const entryPayload = {
    entryType: "PROGRESS",
    body: "Principal reviewed the current classroom evidence with the teacher.",
    parentVisible: true,
    clientRequestId: randomUUID(),
  };
  const entry = await requestJson(
    `/mobile/principal/intervention-cases/${encodeURIComponent(
      createdCase.id,
    )}/entries`,
    { method: "POST", body: JSON.stringify(entryPayload) },
    principal,
  );
  const entryReplay = await requestJson(
    `/mobile/principal/intervention-cases/${encodeURIComponent(
      createdCase.id,
    )}/entries`,
    { method: "POST", body: JSON.stringify(entryPayload) },
    principal,
  );
  assert(
    entry.id && entryReplay.id === entry.id,
    "Follow-up entry replay created another timeline record",
  );
  pass("Principal timeline entry is idempotent and parent visibility is explicit");

  let currentCase = await requestJson(
    `/mobile/principal/intervention-cases/${encodeURIComponent(
      createdCase.id,
    )}`,
    {},
    principal,
  );
  currentCase = await transitionCase(
    principal,
    currentCase,
    "IN_PROGRESS",
    "Principal accepted the teacher-owned follow-up plan.",
  );
  currentCase = await transitionCase(
    principal,
    currentCase,
    "RESOLVED",
    "The planned practice was completed and reviewed.",
    "The student showed consistent progress in the planned classroom checks.",
  );
  currentCase = await transitionCase(
    principal,
    currentCase,
    "CLOSED",
    "The resolved plan is ready to close.",
    "The support cycle is complete; routine classroom observation continues.",
  );
  assert(currentCase.status === "CLOSED", "Follow-up case did not close");
  pass("Versioned intervention lifecycle reaches reasoned closure");

  const [remedial, curriculum, guidance] = await Promise.all([
    requestJson(
      `/learning-improvement/remedial-groups?studentId=${encodeURIComponent(
        fixtureStudentId,
      )}&limit=100`,
      {},
      admin,
    ),
    requestJson(
      `/learning-improvement/curriculum-progress?classId=${encodeURIComponent(
        scope.classId,
      )}&subjectId=${encodeURIComponent(scope.subjectId)}&limit=100`,
      {},
      admin,
    ),
    requestJson(
      `/learning-improvement/parent-guidance?studentId=${encodeURIComponent(
        fixtureStudentId,
      )}&limit=100`,
      {},
      admin,
    ),
  ]);
  assert(
    getItems(remedial).some(
      (item) =>
        item.members?.some(
          (member) => member.student?.id === fixtureStudentId,
        ) && item.status === "ACTIVE",
    ),
    "Active remedial membership fixture is missing",
  );
  assert(
    curriculum.summary?.paceState === "attention_needed" &&
      getItems(curriculum).some(
        (item) =>
          item.status === "RETEACH_REQUIRED" &&
          item.resourceUrl?.startsWith("https://"),
      ),
    "Curriculum pacing or safe resource fixture is missing",
  );
  assert(
    getItems(guidance).some(
      (item) =>
        item.student?.id === fixtureStudentId &&
        item.status === "PUBLISHED",
    ),
    "Published parent guidance fixture is missing",
  );
  pass("Remedial, curriculum, and published-guidance records remain scoped");

  await expectStatus(
    "/learning-improvement/outcomes?limit=10",
    {},
    parent,
    [403],
  );
  pass("Parent cannot open the broad school operations contract");

  console.log(
    `Stage 3 learning-improvement integration passed ${checks.length}/${checks.length} checks.`,
  );
  for (const check of checks) console.log(`✓ ${check}`);
} catch (error) {
  console.error(
    `Stage 3 learning-improvement integration failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}

async function transitionCase(
  token,
  current,
  status,
  reason,
  resolutionSummary,
) {
  return requestJson(
    `/mobile/principal/intervention-cases/${encodeURIComponent(
      current.id,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        reason,
        expectedVersion: current.version,
        ...(resolutionSummary ? { resolutionSummary } : {}),
      }),
    },
    token,
  );
}

function assertParentSummary(summary) {
  assert(
    summary.student?.id === fixtureStudentId,
    "Parent summary returned the wrong student",
  );
  assert(
    summary.outcomeProgress?.some(
      (item) => item.outcome?.id === fixtureOutcomeId,
    ),
    "Parent summary omitted teacher-approved outcome progress",
  );
  assert(
    summary.guidance?.length > 0 &&
      summary.guidance.every((item) => item.status === "PUBLISHED"),
    "Parent summary leaked draft guidance or omitted the published fixture",
  );
  assert(
    summary.remedialSupport?.length > 0,
    "Parent summary omitted active school support",
  );
  assert(
    !JSON.stringify(summary).match(
      /rank|percentile|prediction|requestFingerprint|createdByUserId|actorUserId/i,
    ),
    "Parent summary exposed comparison, prediction, or private internals",
  );
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
