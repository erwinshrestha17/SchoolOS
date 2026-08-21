import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

const operationalDateSurfaces = [
  'app/platform/schools/[tenantId]/change-plan/page.tsx',
  'app/dashboard/activity/milestones/page.tsx',
  'app/dashboard/activity/new/page.tsx',
  'app/dashboard/activity/observations/page.tsx',
  'app/dashboard/homework/page.tsx',
  'app/dashboard/payroll/readiness/page.tsx',
  'app/dashboard/payroll/reports/page.tsx',
  'components/academics/tabs/cas-records-tab.tsx',
  'components/academics/tabs/exam-terms-tab.tsx',
  'components/accounting/voucher-dialog.tsx',
  'components/admissions/admissions-pipeline.tsx',
  'components/attendance/attendance-m2-workspaces.tsx',
  'components/canteen/canteen-workspace.tsx',
  'components/canteen/canteen-reports-workspace.tsx',
  'components/forms/communications-form.tsx',
  'components/homework/homework-create-form.tsx',
  'components/hr/salary-structure-dialog.tsx',
  'components/hr/leave-balance-adjust-dialog.tsx',
  'components/hr/payroll-preview.tsx',
  'components/hr/payroll-runs.tsx',
  'components/hr/staff-attendance-summary.tsx',
  'components/hr/staff-attendance-mark-dialog.tsx',
  'components/hr/staff-create-dialog.tsx',
  'components/hr/staff-lifecycle-dialog.tsx',
  'components/m1/admission-case-wizard.tsx',
  'components/m1/admission-review-case-form.tsx',
  'components/timetable/substitution-modal.tsx',
  'components/timetable/tabs/substitutions-tab.tsx',
  'components/timetable/teacher-schedule-workspace.tsx',
  'components/transport/transport-workspace.tsx',
];

describe('Nepal business-date defaults', () => {
  for (const path of operationalDateSurfaces) {
    it(`${path} derives operational today from the canonical Nepal school day`, () => {
      const source = read(path);

      assert.match(
        source,
        /getNepalSchoolDay\([^)]*\)\.gregorianDate|formatNepalDateTimeLocalInput\(\)|getNepalNow\(\)/,
      );
      assert.doesNotMatch(
        source,
        /new Date\(\)\.toISOString\(\)\.(?:slice\(0, 10\)|split\(['"]T['"]\)\[0\])/,
      );
    });
  }

  it('converts school-entered times as Nepal civil time instead of device-local time', () => {
    const sources = [
      'components/forms/communications-form.tsx',
      'components/hr/staff-attendance-mark-dialog.tsx',
      'components/hr/staff-attendance-correction-dialog.tsx',
      'components/notices/notice-review-workspace.tsx',
    ]
      .map(read)
      .join('\n');

    assert.match(sources, /nepalDateTimeLocalInputToUtc/);
    assert.doesNotMatch(
      sources,
      /new Date\(`\$\{(?:attendanceDate|datePart|event\.startsAt|notice\.scheduledFor)[^`]*`\)/,
    );
  });

  it('derives BS admission and attendance defaults from the Nepal school day', () => {
    const admission = read('components/m1/admission-case-wizard.tsx');
    const attendance = read('components/attendance/attendance-m2-workspaces.tsx');

    assert.match(
      admission,
      /formatBsDateForInput\(getNepalSchoolDay\(\)\.gregorianDate\)/,
    );
    assert.match(attendance, /getNepalSchoolDay\(\)\.bsDate/);
    assert.doesNotMatch(admission, /formatBsDateForInput\(new Date\(\)\)/);
    assert.doesNotMatch(attendance, /toBsDateFromGregorian\(new Date\(\)\)/);
  });
});
