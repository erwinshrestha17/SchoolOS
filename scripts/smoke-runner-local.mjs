#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const requireApiDependency = createRequire(resolve(root, 'apps/api/package.json'));
const { Client: PgClient } = requireApiDependency('pg');
const Redis = requireApiDependency('ioredis');

loadEnvFile(resolve(root, 'apps/api/.env'));

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public';
const redisHost = process.env.REDIS_HOST ?? 'localhost';
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const localDemoPassword =
  process.env.SCHOOLOS_DEMO_PASSWORD ?? 'schoolos-local-demo-only';

const target = process.argv[2] ?? 'pilot';
const validTargets = ['pilot', 'core', 'platform', 'learning', 'full'];

if (!validTargets.includes(target)) {
  console.error(
    `Invalid smoke target: ${target}. Must be one of: ${validTargets.join(', ')}`,
  );
  process.exit(1);
}

const schoolTenant = process.env.SMOKE_TENANT_SLUG ?? 'default-school';
const checks = [];

const accounts = {
  admin: {
    label: 'school admin',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_EMAIL ?? 'admin@schoolos.com',
    password:
      process.env.SMOKE_PASSWORD ??
      process.env.SCHOOLOS_DEMO_ADMIN_PASSWORD ??
      localDemoPassword,
  },
  principal: {
    label: 'principal',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_PRINCIPAL_EMAIL ?? 'principal@schoolos.com',
    password:
      process.env.SMOKE_PRINCIPAL_PASSWORD ??
      process.env.SCHOOLOS_DEMO_PRINCIPAL_PASSWORD ??
      localDemoPassword,
  },
  parent: {
    label: 'parent',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_PARENT_EMAIL ?? 'guardian.c01a001@schoolos.test',
    password:
      process.env.SMOKE_PARENT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_GUARDIAN_PASSWORD ??
      localDemoPassword,
  },
  classTeacher: {
    label: 'class teacher',
    tenantSlug: schoolTenant,
    email:
      process.env.SMOKE_CLASS_TEACHER_EMAIL ?? 'classteacher.1a@schoolos.com',
    password:
      process.env.SMOKE_CLASS_TEACHER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ??
      localDemoPassword,
  },
  subjectTeacher: {
    label: 'subject teacher',
    tenantSlug: schoolTenant,
    email:
      process.env.SMOKE_SUBJECT_TEACHER_EMAIL ??
      'subjectteacher.math@schoolos.com',
    password:
      process.env.SMOKE_SUBJECT_TEACHER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_TEACHER_PASSWORD ??
      localDemoPassword,
  },
  staff: {
    label: 'staff',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_STAFF_EMAIL ?? 'staff@schoolos.com',
    password:
      process.env.SMOKE_STAFF_PASSWORD ??
      process.env.SCHOOLOS_DEMO_STAFF_PASSWORD ??
      localDemoPassword,
  },
  accountant: {
    label: 'accountant',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_ACCOUNTANT_EMAIL ?? 'accountant@schoolos.com',
    password:
      process.env.SMOKE_ACCOUNTANT_PASSWORD ??
      process.env.SCHOOLOS_DEMO_ACCOUNTANT_PASSWORD ??
      localDemoPassword,
  },
  driver: {
    label: 'driver',
    tenantSlug: schoolTenant,
    email: process.env.SMOKE_DRIVER_EMAIL ?? 'driver@schoolos.com',
    password:
      process.env.SMOKE_DRIVER_PASSWORD ??
      process.env.SCHOOLOS_DEMO_DRIVER_PASSWORD ??
      localDemoPassword,
  },
  platform: {
    label: 'platform admin',
    tenantSlug:
      process.env.SMOKE_PLATFORM_TENANT_SLUG ??
      process.env.PLATFORM_SEED_TENANT_SLUG ??
      schoolTenant,
    email:
      process.env.SMOKE_PLATFORM_EMAIL ??
      process.env.PLATFORM_SEED_EMAIL ??
      'platform@schoolos.com',
    password:
      process.env.SMOKE_PLATFORM_PASSWORD ??
      process.env.PLATFORM_SEED_PASSWORD ??
      process.env.SCHOOLOS_DEMO_PLATFORM_PASSWORD ??
      localDemoPassword,
  },
};

async function main() {
  console.log(`--- Running SchoolOS Smoke Suite: ${target.toUpperCase()} ---`);

  checks.push(await checkPostgres());
  checks.push(await checkRedis());
  checks.push(await checkApiEndpoint('API /health', '/health'));
  checks.push(await checkApiEndpoint('API /ready', '/ready'));

  const tokens = {};

  if (['pilot', 'core', 'learning', 'full'].includes(target)) {
    const loginCheck = await checkSeededLogin(accounts.admin);
    checks.push(loginCheck);
    if (loginCheck.status === 'ok') tokens.admin = loginCheck.token;
  }

  if (['platform', 'full'].includes(target)) {
    const loginCheck = await checkSeededLogin(accounts.platform);
    checks.push(loginCheck);
    if (loginCheck.status === 'ok') tokens.platform = loginCheck.token;
  }

  if (['platform', 'full'].includes(target) && tokens.platform) {
    checks.push(
      await checkAuthApiEndpoint(
        'Platform Health (/platform/health)',
        '/platform/health',
        tokens.platform,
      ),
    );
  }

  if (['learning', 'full'].includes(target) && tokens.admin) {
    checks.push(
      await checkAuthApiEndpoint(
        'Learning Activities (/learning/activities)',
        '/learning/activities',
        tokens.admin,
      ),
    );
  }

  if (['pilot', 'full'].includes(target) && tokens.admin) {
    checks.push(await checkExpectedHttpFailure('Auth required denial', '/auth/me', null, [401]));
    await runPilotRoleChecks(tokens);
  }

  const failed = checks.filter((check) => check.status !== 'ok');

  console.log('');
  for (const check of checks) {
    const prefix = check.status === 'ok' ? 'OK  ' : 'FAIL';
    console.log(`${prefix} ${check.name}${check.message ? ` - ${check.message}` : ''}`);
  }
  console.log('');

  if (failed.length > 0) {
    console.log(`Smoke suite failed with ${failed.length} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('Smoke suite completed successfully.');
  }
}

async function runPilotRoleChecks(tokens) {
  const roleTokens = {};
  for (const key of [
    'principal',
    'parent',
    'classTeacher',
    'subjectTeacher',
    'staff',
    'accountant',
    'driver',
  ]) {
    const loginCheck = await checkSeededLogin(accounts[key]);
    checks.push(loginCheck);
    if (loginCheck.status === 'ok') roleTokens[key] = loginCheck.token;
  }

  const adminStudents = await fetchOk(
    'Admin can list seeded students',
    '/students?limit=25',
    tokens.admin,
  );
  checks.push(adminStudents.check);
  const seededStudents = getItems(adminStudents.body);
  const adminSections = await fetchOk(
    'Admin can list seeded sections',
    '/sections',
    tokens.admin,
  );
  checks.push(adminSections.check);
  const seededSections = getItems(adminSections.body);

  if (roleTokens.parent) {
    await checkParentScope(roleTokens.parent, seededStudents);
  }
  if (roleTokens.classTeacher) {
    await checkClassTeacherScope(roleTokens.classTeacher, seededSections);
  }
  if (roleTokens.subjectTeacher) {
    await checkSubjectTeacherScope(roleTokens.subjectTeacher);
  }
  if (roleTokens.principal) {
    await checkPrincipalScope(roleTokens.principal);
  }
  if (roleTokens.staff) {
    await checkStaffScope(roleTokens.staff);
  }
  if (roleTokens.accountant) {
    await checkAccountantScope(roleTokens.accountant);
  }
  if (roleTokens.driver) {
    await checkDriverScope(roleTokens.driver, tokens.admin);
  }
  if (tokens.admin) {
    await checkAdminEmptyState(tokens.admin);
  }
}

async function checkParentScope(parentToken, seededStudents) {
  const childrenResult = await fetchOk(
    'Parent can list linked children',
    '/mobile/me/students',
    parentToken,
  );
  checks.push(childrenResult.check);
  const children = getItems(childrenResult.body);
  if (children.length !== 1) {
    checks.push({
      name: 'Parent linked child count',
      status: 'error',
      message: `Expected exactly 1 linked child, got ${children.length}`,
    });
    return;
  }

  const childId = children[0]?.id;
  checks.push(assertCheck('Parent linked child has id', Boolean(childId)));
  if (!childId) return;

  checks.push(
    (await fetchOk('Parent can read linked child profile', `/mobile/students/${childId}/profile`, parentToken)).check,
  );
  checks.push(
    (await fetchOk('Parent can read linked child attendance summary', `/mobile/students/${childId}/attendance-summary`, parentToken)).check,
  );
  checks.push(
    (await fetchOk('Parent can read linked child fees summary', `/mobile/students/${childId}/fees-summary`, parentToken)).check,
  );

  const otherStudent = seededStudents.find((student) => student.id && student.id !== childId);
  if (otherStudent?.id) {
    checks.push(
      await checkExpectedHttpFailure(
        'Parent cannot access another child profile',
        `/mobile/students/${otherStudent.id}/profile`,
        parentToken,
        [403, 404],
      ),
    );
  } else {
    checks.push({
      name: 'Parent forbidden other-child fixture',
      status: 'error',
      message: 'Could not discover another seeded student',
    });
  }
}

async function checkClassTeacherScope(classTeacherToken, seededSections) {
  const classesResult = await fetchOk(
    'Class teacher can list assigned attendance classes',
    '/mobile/teacher/attendance/classes',
    classTeacherToken,
  );
  checks.push(classesResult.check);
  const scopes = getItems(classesResult.body);
  if (scopes.length === 0) {
    checks.push({
      name: 'Class teacher assigned class fixture',
      status: 'error',
      message: 'No assigned attendance classes returned',
    });
    return;
  }

  const scope = scopes[0];
  checks.push(
    (await fetchOk('Class teacher can read attendance today', '/mobile/teacher/attendance/today', classTeacherToken)).check,
  );
  const rosterPath = queryPath('/mobile/teacher/attendance/roster', {
    academicYearId: scope.academicYearId,
    classId: scope.classId,
    sectionId: scope.sectionId,
  });
  checks.push(
    (await fetchOk('Class teacher can read assigned roster', rosterPath, classTeacherToken)).check,
  );

  const unassigned = seededSections.find(
    (section) =>
      section.class?.id &&
      section.id &&
      !scopes.some(
        (item) =>
          item.classId === section.class.id && item.sectionId === section.id,
      ),
  );
  if (unassigned?.class?.id && unassigned?.id && scope.academicYearId) {
    checks.push(
      await checkExpectedHttpFailure(
        'Class teacher cannot read unassigned roster',
        queryPath('/mobile/teacher/attendance/roster', {
          academicYearId: scope.academicYearId,
          classId: unassigned.class.id,
          sectionId: unassigned.id,
        }),
        classTeacherToken,
        [403, 404],
      ),
    );
  } else {
    checks.push({
      name: 'Class teacher forbidden roster fixture',
      status: 'error',
      message: 'Could not discover an unassigned class/section',
    });
  }
}

async function checkSubjectTeacherScope(subjectTeacherToken) {
  const scopesResult = await fetchOk(
    'Subject teacher can list assigned homework scopes',
    '/mobile/teacher/homework/scopes',
    subjectTeacherToken,
  );
  checks.push(scopesResult.check);
  const scopes = getItems(scopesResult.body);
  if (scopes.length === 0) {
    checks.push({
      name: 'Subject teacher assigned scope fixture',
      status: 'error',
      message: 'No assigned subject scopes returned',
    });
    return;
  }

  const scope = scopes[0];
  checks.push(
    (await fetchOk(
      'Subject teacher can list scoped homework',
      queryPath('/mobile/teacher/homework', {
        classId: scope.classId,
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
        limit: 10,
      }),
      subjectTeacherToken,
    )).check,
  );
  checks.push(
    (await fetchOk(
      'Subject teacher can read own timetable',
      '/mobile/teacher/timetable?days=7',
      subjectTeacherToken,
    )).check,
  );

  checks.push(
    await checkExpectedHttpFailure(
      'Subject teacher cannot use class-teacher attendance route',
      '/mobile/teacher/attendance/classes',
      subjectTeacherToken,
      [403],
    ),
  );
}

async function checkPrincipalScope(principalToken) {
  const dashboard = await fetchOk(
    'Principal can read mobile dashboard',
    '/mobile/principal/dashboard',
    principalToken,
  );
  checks.push(dashboard.check);
  checks.push(
    (await fetchOk('Principal can read attendance summary', '/mobile/principal/attendance-summary', principalToken)).check,
  );
  checks.push(
    (await fetchOk('Principal can read transport alerts', '/mobile/principal/transport-alerts', principalToken)).check,
  );

  const dashboardText = JSON.stringify(dashboard.body ?? {});
  const sensitiveTerms = ['bankAccount', 'tokenHash', 'passwordHash', 'rawObjectKey'];
  checks.push(
    assertCheck(
      'Principal dashboard omits sensitive internals',
      !sensitiveTerms.some((term) => dashboardText.includes(term)),
    ),
  );
  checks.push(
    await checkExpectedHttpFailure(
      'Principal cannot access platform health',
      '/platform/health',
      principalToken,
      [403],
    ),
  );
}

async function checkStaffScope(staffToken) {
  checks.push(
    (await fetchOk('Staff can read own attendance', '/hr/me/attendance', staffToken)).check,
  );
  checks.push(
    (await fetchOk('Staff can read own leave requests', '/hr/me/leave-requests', staffToken)).check,
  );
  checks.push(
    (await fetchOk('Staff can read own leave balances', '/hr/me/leave-balances', staffToken)).check,
  );
  checks.push(
    (await fetchOk('Staff can read own payslips', '/payroll/me/payslips', staffToken)).check,
  );
  checks.push(
    await checkExpectedHttpFailure(
      'Staff cannot list all payslips',
      '/payroll/payslips',
      staffToken,
      [403],
    ),
  );
}

async function checkAccountantScope(accountantToken) {
  checks.push(
    (await fetchOk('Accountant can list fee invoices', '/fees/invoices', accountantToken)).check,
  );
  checks.push(
    (await fetchOk('Accountant can list finance dues', '/finance/dues?limit=10', accountantToken)).check,
  );
  const collections = await fetchOk(
    'Accountant can read backend collection report',
    '/finance/reports/collections',
    accountantToken,
  );
  checks.push(collections.check);
  checks.push(
    assertCheck(
      'Accountant collection report returns server-owned totals',
      collections.check.status !== 'ok' || hasAnyNumericTotal(collections.body),
    ),
  );
}

async function checkDriverScope(driverToken, adminToken) {
  const ownTripsResult = await fetchOk(
    'Driver can list assigned active trips',
    '/transport/driver/trips/active',
    driverToken,
  );
  checks.push(ownTripsResult.check);
  const ownTrips = getItems(ownTripsResult.body);
  if (ownTrips.length === 0) {
    checks.push({
      name: 'Driver active trip fixture',
      status: 'error',
      message: 'No assigned active trips returned',
    });
    return;
  }

  checks.push(
    (await fetchOk('Driver can read own dashboard', '/transport/driver/dashboard', driverToken)).check,
  );
  checks.push(
    (await fetchOk('Driver can read own assignments', '/transport/driver/assignments', driverToken)).check,
  );
  checks.push(
    (await fetchOk(
      'Driver can read assigned trip manifest',
      `/transport/driver/trips/${ownTrips[0].id}/manifest`,
      driverToken,
    )).check,
  );

  const allTripsResult = await fetchOk(
    'Admin can list active transport trips for driver fixture',
    '/transport/driver/trips/active',
    adminToken,
  );
  checks.push(allTripsResult.check);
  const allTrips = getItems(allTripsResult.body);
  const otherTrip = allTrips.find(
    (trip) => trip.id && !ownTrips.some((ownTrip) => ownTrip.id === trip.id),
  );
  if (otherTrip?.id) {
    checks.push(
      await checkExpectedHttpFailure(
        'Driver cannot read another driver manifest',
        `/transport/driver/trips/${otherTrip.id}/manifest`,
        driverToken,
        [403, 404],
      ),
    );
  } else {
    checks.push({
      name: 'Driver forbidden trip fixture',
      status: 'error',
      message: 'Could not discover another driver active trip',
    });
  }
}

async function checkAdminEmptyState(adminToken) {
  const result = await request('/mobile/me/students', authOptions(adminToken));
  if (result.status === 403) {
    checks.push({
      name: 'Non-parent mobile child list fails closed',
      status: 'ok',
    });
    return;
  }

  if (result.ok) {
    checks.push({
      name: 'Non-parent mobile child list returns valid empty state',
      status: 'ok',
    });
    checks.push(
      assertCheck(
        'Non-parent mobile child list is empty',
        getItems(result.body).length === 0,
      ),
    );
    return;
  }

  checks.push({
    name: 'Non-parent mobile child list returns empty or permission state',
    status: 'error',
    message: `HTTP ${result.status}: ${trimBody(result.bodyText)}`,
  });
}

async function checkPostgres() {
  const client = new PgClient({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return { name: 'Postgres connectivity', status: 'ok' };
  } catch (error) {
    return {
      name: 'Postgres connectivity',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkRedis() {
  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => undefined);

  try {
    await redis.connect();
    const response = await redis.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis PING response: ${response}`);
    }

    return { name: 'Redis connectivity', status: 'ok' };
  } catch (error) {
    return {
      name: 'Redis connectivity',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

async function checkApiEndpoint(name, path) {
  const result = await request(path);
  if (result.ok) return { name, status: 'ok' };
  return {
    name,
    status: 'error',
    message: `HTTP ${result.status}: ${trimBody(result.bodyText)}`,
  };
}

async function checkSeededLogin(account) {
  try {
    const result = await request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'flutter',
      },
      body: JSON.stringify({
        tenantSlug: account.tenantSlug,
        email: account.email,
        password: account.password,
      }),
    });

    if (!result.ok) {
      throw new Error(`HTTP ${result.status}: ${trimBody(result.bodyText)}`);
    }

    const token = result.body?.data?.accessToken ?? result.body?.accessToken;
    if (!token) {
      throw new Error('Response did not contain accessToken');
    }

    return { name: `Seeded ${account.label} login`, status: 'ok', token };
  } catch (error) {
    return {
      name: `Seeded ${account.label} login`,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkAuthApiEndpoint(name, path, token) {
  const result = await request(path, authOptions(token));
  if (result.ok) return { name, status: 'ok' };
  return {
    name,
    status: 'error',
    message: `HTTP ${result.status}: ${trimBody(result.bodyText)}`,
  };
}

async function fetchOk(name, path, token) {
  const result = await request(path, authOptions(token));
  if (result.ok) {
    return { check: { name, status: 'ok' }, body: result.body };
  }
  return {
    check: {
      name,
      status: 'error',
      message: `HTTP ${result.status}: ${trimBody(result.bodyText)}`,
    },
    body: result.body,
  };
}

async function checkExpectedHttpFailure(name, path, token, expectedStatuses) {
  const result = await request(path, token ? authOptions(token) : undefined);
  if (expectedStatuses.includes(result.status)) {
    return { name, status: 'ok' };
  }
  return {
    name,
    status: 'error',
    message: `Expected HTTP ${expectedStatuses.join('/')} but got ${result.status}: ${trimBody(result.bodyText)}`,
  };
}

async function request(path, options = {}) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, options);
    const bodyText = await response.text();
    let body = null;
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = null;
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      bodyText,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      bodyText: error instanceof Error ? error.message : String(error),
    };
  }
}

function authOptions(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'flutter',
    },
  };
}

function getItems(body) {
  const data = body?.data ?? body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.children)) return data.children;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function queryPath(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function assertCheck(name, condition) {
  return condition
    ? { name, status: 'ok' }
    : { name, status: 'error', message: 'Assertion failed' };
}

function hasAnyNumericTotal(body) {
  const text = JSON.stringify(body ?? {});
  return /"[^"]*(total|amount|paid|due|collected)[^"]*"\s*:\s*"?-?\d/i.test(text);
}

function trimBody(value) {
  return String(value ?? '').slice(0, 500);
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

await main();
