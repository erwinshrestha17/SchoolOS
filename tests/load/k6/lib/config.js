// Shared configuration and helpers for the SchoolOS k6 load-test suite.
// See docs/performance/LOAD_TEST_PLAN.md for scenario definitions.

import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.PERF_BASE_URL || 'http://localhost:4000';
export const API = `${BASE_URL}/api/v1`;
export const TENANT_SLUG = __ENV.PERF_TENANT_SLUG || 'perf-school';
export const PASSWORD = __ENV.PERF_PASSWORD || 'LoadTest123!';

// Population sizes must match what the seed generator produced, otherwise
// virtual users authenticate as accounts that do not exist.
export const PARENT_COUNT = Number(__ENV.PERF_PARENT_COUNT || 3000);
export const TEACHER_COUNT = Number(__ENV.PERF_TEACHER_COUNT || 50);
export const ADMIN_COUNT = Number(__ENV.PERF_ADMIN_COUNT || 15);

/**
 * The API selects the JWT audience from the User-Agent: a Dart/Flutter agent
 * gets the mobile audience and receives bearer tokens in the response body,
 * which is what mobile scenarios must exercise. Web scenarios use cookies.
 */
export const MOBILE_UA = 'Dart/3.0 (dart:io)';

export function pad(value, width) {
  return String(value).padStart(width, '0');
}

/** Spread virtual users across the seeded population deterministically. */
export function parentEmail(index) {
  return `parent${pad((index % PARENT_COUNT) + 1, 5)}@${TENANT_SLUG}.test`;
}
export function teacherEmail(index) {
  return `teacher${pad((index % TEACHER_COUNT) + 1, 3)}@${TENANT_SLUG}.test`;
}
export function adminEmail(index) {
  return `admin${pad((index % ADMIN_COUNT) + 1, 3)}@${TENANT_SLUG}.test`;
}

/**
 * Authenticate and return a bearer token, or null on failure.
 * Login is tagged separately so its latency can be asserted against the
 * dedicated < 2 s p95 target without polluting general API percentiles.
 */
export function login(email) {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email, password: PASSWORD, tenantSlug: TENANT_SLUG }),
    {
      headers: { 'Content-Type': 'application/json', 'User-Agent': MOBILE_UA },
      tags: { name: 'auth/login' },
    },
  );

  const ok = check(res, {
    // NestJS answers POST with 201 by default; the login handler does not
    // override it. Accept both so the harness does not depend on that detail.
    'login 2xx': (r) => r.status === 200 || r.status === 201,
    'login returns token': (r) => {
      try {
        return Boolean(r.json('data.accessToken'));
      } catch {
        return false;
      }
    },
  });

  return ok ? res.json('data.accessToken') : null;
}

export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': MOBILE_UA,
    },
  };
}

/**
 * GET with a stable tag so percentiles group by endpoint rather than by the
 * concrete URL (which contains student ids).
 */
export function get(token, path, name) {
  const res = http.get(`${API}${path}`, {
    ...authHeaders(token),
    tags: { name: name || path },
  });
  check(res, { [`${name || path} ok`]: (r) => r.status === 200 });
  return res;
}

export function post(token, path, body, name) {
  const res = http.post(`${API}${path}`, JSON.stringify(body), {
    headers: {
      ...authHeaders(token).headers,
      'Content-Type': 'application/json',
    },
    tags: { name: name || path },
  });
  return res;
}

/**
 * Acceptance thresholds from ONE_SCHOOL_CONCURRENCY_TARGET.md §4.
 * `abortOnFail` is deliberately off: a failing run should still produce a full
 * result set so the degradation curve is visible.
 */
export const ACCEPTANCE_THRESHOLDS = {
  http_req_failed: ['rate<0.005'],
  'http_req_duration{name:auth/login}': ['p(95)<2000'],
  'http_req_duration{name:parent/bootstrap}': ['p(95)<800'],
  'http_req_duration{name:attendance/submit}': ['p(95)<1000'],
  http_req_duration: ['p(95)<800'],
  checks: ['rate>0.995'],
};
