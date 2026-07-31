/**
 * SchoolOS load-test scenarios A–F.
 *
 * One file, selected with SCENARIO, so the traffic mix and thresholds stay in
 * one place and stages are directly comparable.
 *
 *   k6 run -e SCENARIO=A tests/load/k6/scenarios.js
 *
 * Scenarios (see docs/performance/LOAD_TEST_PLAN.md):
 *   A  normal day               200 VUs, 30 min
 *   B  morning attendance       300 parents + 50 teachers + 10 admins
 *   C  evening parent peak      500 parents
 *   D  result publication       750 parents
 *   E  required concurrency     1,000 mixed VUs, 15–30 min
 *   F  failure boundary         ramp 1,000 -> 1,500
 *   S  smoke                    5 VUs, 1 min (use to validate the harness)
 */
import {
  ACCEPTANCE_THRESHOLDS,
  adminEmail,
  login,
  parentEmail,
  teacherEmail,
} from './lib/config.js';
import {
  adminOverview,
  parentBootstrap,
  parentBrowse,
  parentResultDay,
  teacherAttendance,
  think,
} from './lib/workflows.js';

const SCENARIO = (__ENV.SCENARIO || 'S').toUpperCase();
const DURATION = __ENV.DURATION || null;

/**
 * Scales every VU count in the selected scenario. Intended for rehearsing a
 * scenario on constrained hardware before committing to a full run.
 *
 * A scaled run is NOT a run of that scenario: results from VU_SCALE < 1 must
 * never be reported against the acceptance criteria, only used to validate the
 * harness and observe the shape of the curve.
 */
const VU_SCALE = Number(__ENV.VU_SCALE || 1);

function scaleVus(count) {
  return Math.max(1, Math.round(count * VU_SCALE));
}

// --- scenario definitions --------------------------------------------------

const SCENARIOS = {
  S: {
    parent: { vus: 4, duration: '1m' },
    teacher: { vus: 1, duration: '1m' },
  },
  A: {
    parent: { vus: 170, duration: DURATION || '30m' },
    teacher: { vus: 20, duration: DURATION || '30m' },
    admin: { vus: 10, duration: DURATION || '30m' },
  },
  B: {
    parent: { vus: 300, duration: DURATION || '15m' },
    teacherAttendance: { vus: 50, duration: DURATION || '15m' },
    admin: { vus: 10, duration: DURATION || '15m' },
  },
  C: {
    parentBrowse: { vus: 500, duration: DURATION || '20m' },
  },
  D: {
    parentResults: { vus: 750, duration: DURATION || '15m' },
  },
  E: {
    parent: { vus: 700, duration: DURATION || '20m' },
    parentBrowse: { vus: 200, duration: DURATION || '20m' },
    teacherAttendance: { vus: 70, duration: DURATION || '20m' },
    admin: { vus: 30, duration: DURATION || '20m' },
  },
  F: {
    // Ramp past the target until something gives. Thresholds are relaxed
    // because the point of this run is to locate the boundary, not to pass.
    parent: {
      executor: 'ramping-vus',
      startVUs: 500,
      stages: [
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1250 },
        { duration: '5m', target: 1500 },
        { duration: '5m', target: 1500 },
        { duration: '3m', target: 0 }, // recovery observation
      ],
    },
  },
};

const selected = SCENARIOS[SCENARIO];
if (!selected) {
  throw new Error(
    `Unknown SCENARIO "${SCENARIO}". Valid: ${Object.keys(SCENARIOS).join(', ')}`,
  );
}

// Map logical groups onto k6 executors.
const EXEC_FOR_GROUP = {
  parent: 'parentOpenApp',
  parentBrowse: 'parentEveningBrowse',
  parentResults: 'parentResultDayFlow',
  teacher: 'teacherDay',
  teacherAttendance: 'teacherMorningAttendance',
  admin: 'adminDay',
};

const scenarios = {};
for (const [group, cfg] of Object.entries(selected)) {
  scenarios[group] = cfg.executor
    ? {
        ...cfg,
        startVUs: cfg.startVUs ? scaleVus(cfg.startVUs) : undefined,
        stages: cfg.stages?.map((stage) => ({
          ...stage,
          target: scaleVus(stage.target),
        })),
        exec: EXEC_FOR_GROUP[group],
      }
    : {
        executor: 'constant-vus',
        vus: scaleVus(cfg.vus),
        duration: cfg.duration,
        exec: EXEC_FOR_GROUP[group],
      };
}

export const options = {
  scenarios,
  // Scenario F is a discovery run; asserting acceptance thresholds there would
  // just mark an expected outcome as a failure.
  thresholds: SCENARIO === 'F' ? {} : ACCEPTANCE_THRESHOLDS,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// --- virtual-user entry points --------------------------------------------
//
// Each VU logs in once per iteration loop rather than per request. Re-logging
// on every iteration would make the run an auth benchmark and would also be
// unrealistic: real clients hold a token and refresh it.

export function parentOpenApp() {
  const token = login(parentEmail(__VU));
  if (!token) return;

  const studentId = parentBootstrap(token);
  think(5, 15);
  if (studentId) {
    parentBrowse(token, studentId);
  }
  think(10, 30);
}

export function parentEveningBrowse() {
  const token = login(parentEmail(__VU));
  if (!token) return;

  const studentId = parentBootstrap(token);
  think(3, 8);
  parentBrowse(token, studentId);
  think(15, 45);
}

export function parentResultDayFlow() {
  const token = login(parentEmail(__VU));
  if (!token) return;

  const studentId = parentBootstrap(token);
  think(2, 5);
  parentResultDay(token, studentId);
  think(10, 30);
}

export function teacherDay() {
  const token = login(teacherEmail(__VU));
  if (!token) return;

  teacherAttendance(token, __ITER, __VU);
  think(30, 90);
}

export function teacherMorningAttendance() {
  const token = login(teacherEmail(__VU));
  if (!token) return;

  teacherAttendance(token, __ITER, __VU);
  think(20, 60);
}

export function adminDay() {
  const token = login(adminEmail(__VU));
  if (!token) return;

  adminOverview(token);
  think(20, 60);
}
