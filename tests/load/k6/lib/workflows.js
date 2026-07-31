// Persona workflows shared by every scenario, so the traffic mix in one
// scenario is directly comparable to another.

import { sleep } from 'k6';
import { get, post } from './config.js';

/** Human pause between screens, randomised so VUs do not march in lockstep. */
export function think(minSeconds, maxSeconds) {
  sleep(minSeconds + Math.random() * (maxSeconds - minSeconds));
}

/**
 * Parent app open: the request fan-out a parent triggers by launching the app.
 * `mobile/me/dashboard` is the de-facto bootstrap endpoint today and is tagged
 * `parent/bootstrap` so it is measured against the < 800 ms p95 target.
 *
 * Returns the selected student id for follow-up calls, or null.
 */
export function parentBootstrap(token) {
  const dashboard = get(token, '/mobile/me/dashboard', 'parent/bootstrap');
  get(token, '/mobile/me/notifications/unread-count', 'parent/unread-count');

  try {
    return dashboard.json('data.selectedStudent.id');
  } catch {
    return null;
  }
}

/** Evening peak behaviour: parent browses each module in turn. */
export function parentBrowse(token, studentId) {
  if (!studentId) return;

  get(token, `/mobile/students/${studentId}/attendance-summary`, 'parent/attendance');
  think(2, 5);
  get(token, `/mobile/students/${studentId}/homework`, 'parent/homework');
  think(2, 5);
  get(token, `/mobile/students/${studentId}/timetable`, 'parent/timetable');
  think(1, 4);
  get(token, '/mobile/me/notifications', 'parent/notifications');
  think(1, 4);
  get(token, `/mobile/students/${studentId}/fees-summary`, 'parent/fees');
}

/** Result-day behaviour: notification -> result summary -> report card. */
export function parentResultDay(token, studentId) {
  if (!studentId) return;

  get(token, '/mobile/me/notifications', 'parent/notifications');
  think(1, 3);
  get(token, `/mobile/students/${studentId}/report-cards`, 'parent/report-cards');
  think(2, 6);
}

/**
 * Teacher morning attendance, following the real mobile route surface:
 *   GET  mobile/teacher/timetable
 *   GET  mobile/teacher/attendance/classes    -> assigned class/section scope
 *   GET  mobile/teacher/attendance/roster     -> today's roster
 *   POST mobile/teacher/attendance/sync       -> offline-capable submit
 *
 * The sync call is issued twice with the SAME `clientSubmissionId` to exercise
 * the offline-retry path. `AttendanceSession` carries
 * `@@unique([tenantId, sourceClientSubmissionId])`, so a correct
 * implementation replays the original receipt instead of creating a second
 * session. The retry is tagged separately so duplicate-write regressions show
 * up as a changed status code rather than being averaged away.
 */
export function teacherAttendance(token, iteration, vu) {
  get(token, '/mobile/teacher/timetable', 'teacher/timetable');
  think(1, 3);

  const classes = get(
    token,
    '/mobile/teacher/attendance/classes',
    'teacher/classes',
  );

  // Response envelope is { data: { items: [...] } } — see
  // ResponseEnvelopeInterceptor.
  let scope = null;
  try {
    const items = classes.json('data.items');
    scope = Array.isArray(items) && items.length ? items[0] : null;
  } catch {
    scope = null;
  }
  if (!scope || !scope.classId || !scope.academicYearId) return;

  const attendanceDate = new Date().toISOString().slice(0, 10);
  const query =
    `?academicYearId=${scope.academicYearId}` +
    `&classId=${scope.classId}` +
    (scope.sectionId ? `&sectionId=${scope.sectionId}` : '') +
    `&attendanceDate=${attendanceDate}`;

  get(token, `/mobile/teacher/attendance/roster${query}`, 'teacher/roster');
  think(3, 8);

  // Exception-based submission: an empty `exceptions` list means "all present",
  // which is the common real case and keeps the payload representative.
  const body = {
    academicYearId: scope.academicYearId,
    classId: scope.classId,
    sectionId: scope.sectionId ?? undefined,
    attendanceDate,
    exceptions: [],
    clientSubmissionId: `k6-${vu}-${iteration}-${attendanceDate}`,
    deviceTimestamp: new Date().toISOString(),
    deviceId: `k6-device-${vu}`,
  };

  post(token, '/mobile/teacher/attendance/sync', body, 'attendance/submit');
  think(0.5, 1.5);
  post(token, '/mobile/teacher/attendance/sync', body, 'attendance/submit-retry');
}

/** Admin / leadership read-heavy dashboard usage. */
export function adminOverview(token) {
  get(token, '/operational-summary', 'admin/summary');
  think(3, 8);
  get(token, '/notices', 'admin/notices');
  think(3, 8);
}
