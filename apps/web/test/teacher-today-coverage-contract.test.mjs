import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('subject-only and substitution periods count as real teacher work', () => {
  const workspace = read('components/dashboard/teacher-today-workspace.tsx');
  const contract = read('lib/api/teacher-workspace.ts');

  assert.match(workspace, /const hasTeachingWork =/);
  assert.match(workspace, /todaysPeriods\.length > 0/);
  // A failed schedule source is never read as "no assignments".
  assert.match(workspace, /attendanceUnavailable \|\|\s*hasAttendanceClasses/);
  assert.match(workspace, /Boolean\(data\.substitutions\?\.length\)/);
  assert.match(workspace, /!hasTeachingWork/);
  assert.match(workspace, /No\s+homeroom attendance\s+class is assigned/);
  assert.match(
    contract,
    /coverageStatus\?: ['"]SCHEDULED['"] \| ['"]SUBSTITUTING['"] \| ['"]COVERED['"]/,
  );
});

test('coverage labels come from the backend period contract', () => {
  const workspace = read('components/dashboard/teacher-today-workspace.tsx');

  assert.match(workspace, /period\.coverageStatus === ['"]SUBSTITUTING['"]/);
  assert.match(workspace, /You are substituting for this period/);
  assert.match(workspace, /A substitute is covering this period/);
});

test('Teacher Today distinguishes a failed panel from a disabled module (Phase 4)', () => {
  const workspace = read('components/dashboard/teacher-today-workspace.tsx');
  const contract = read('lib/api/teacher-workspace.ts');

  assert.match(contract, /unavailablePanels\?: string\[\]/);
  assert.match(contract, /todaysPeriods: TeacherTodayPeriod\[\] \| null/);
  for (const panel of ['homework', 'timetable', 'marksDeadlines']) {
    assert.match(workspace, new RegExp(`unavailable\\.has\\('${panel}'\\)`));
  }
  assert.match(workspace, /could not be loaded right now/);
});

test('Teacher Today shows the schedule with a Now marker and a take-attendance deep link', () => {
  const workspace = read('components/dashboard/teacher-today-workspace.tsx');

  assert.match(workspace, /aria-current=\{isNow \? 'time' : undefined\}/);
  assert.match(workspace, /\/dashboard\/attendance\/mark\?/);
  assert.match(workspace, /attendanceDate: date/);
  assert.match(workspace, /Take attendance/);
});
